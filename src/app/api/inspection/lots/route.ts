import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { authorize, AuthorizationError } from "@/lib/rbac";
import { recordAuditLog } from "@/lib/audit";
import { buildModuleWorkflowSettingsCreate, toModuleWorkflowPolicy } from "@/lib/module-workflow-policy";
import { normalizeQuantityMode } from "@/lib/intake-workflow";
import { isLotVersionConflict, parseExpectedUpdatedAt } from "@/lib/lot-concurrency";
import { recomputeJobWorkflowMilestones } from "@/lib/workflow-milestones";
import { buildLotConflictEscalation, enqueueWorkflowEscalationSafe } from "@/lib/workflow-escalation";

function jsonError(error: string, details: string, status: number) {
  return NextResponse.json({ error, details }, { status });
}

function deriveTotalBags(input: {
  quantityMode: "SINGLE_PIECE" | "MULTI_WEIGHT";
  bagCount?: number | null;
  pieceCount?: number | null;
  totalBags?: number | null;
}) {
  if (input.quantityMode === "MULTI_WEIGHT") {
    return Math.max(input.totalBags ?? input.bagCount ?? 1, 1);
  }
  return Math.max(input.bagCount ?? input.pieceCount ?? input.totalBags ?? 1, 1);
}

function deriveLotStatus(input: {
  quantityMode: "SINGLE_PIECE" | "MULTI_WEIGHT";
  materialName: string;
  bagCount?: number | null;
  pieceCount?: number | null;
  grossWeight?: number | null;
  netWeight?: number | null;
}) {
  const hasSinglePieceQuantity = Boolean(
    (input.bagCount ?? 0) > 0 ||
    (input.pieceCount ?? 0) > 0 ||
    input.grossWeight !== undefined && input.grossWeight !== null ||
    input.netWeight !== undefined && input.netWeight !== null,
  );

  if (input.materialName.trim().length === 0) {
    return "CREATED";
  }

  if (input.quantityMode === "MULTI_WEIGHT" || hasSinglePieceQuantity) {
    return "DETAILS_CAPTURED";
  }

  return "CREATED";
}

function mergeLotStatus(existingStatus: string | null | undefined, derivedStatus: string) {
  if (existingStatus && ["INSPECTION_IN_PROGRESS", "READY_FOR_SAMPLING", "ON_HOLD", "REJECTED"].includes(existingStatus)) {
    return existingStatus;
  }
  return derivedStatus;
}

async function validateJobAccess(jobId: string, companyId: string) {
  const job = await prisma.inspectionJob.findUnique({
    where: { id: jobId },
    select: { id: true, companyId: true, status: true },
  });

  if (!job || job.companyId !== companyId) {
    return { error: jsonError("Forbidden", "Cross-company access is not allowed.", 403) };
  }
  return { job };
}

async function getWorkflowPolicy(companyId: string) {
  const settings = await prisma.moduleWorkflowSettings.upsert({
    where: { companyId },
    update: {},
    create: buildModuleWorkflowSettingsCreate(companyId),
  });
  return toModuleWorkflowPolicy(settings);
}

async function buildAutoLotNumber(jobId: string, companyId: string, prefix: string, sequenceFormat: string) {
  const count = await prisma.inspectionLot.count({
    where: { jobId, companyId },
  });
  const width = Math.max(sequenceFormat.length, 4);
  return `${prefix}-${String(count + 1).padStart(width, "0")}`;
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "CREATE_LOT");

    const body = await req.json();
    const jobId = typeof body?.jobId === "string" ? body.jobId.trim() : "";
    const requestedLotNumber = typeof body?.lotNumber === "string" ? body.lotNumber.trim() : "";
    const materialName = typeof body?.materialName === "string" ? body.materialName.trim() : "";
    const materialCategory = typeof body?.materialCategory === "string" ? body.materialCategory.trim() : "";
    const quantityMode = normalizeQuantityMode(typeof body?.quantityMode === "string" ? body.quantityMode : null);
    const bagCount = body?.bagCount === null || body?.bagCount === undefined ? null : Number(body.bagCount);
    const pieceCount = body?.pieceCount === null || body?.pieceCount === undefined ? null : Number(body.pieceCount);
    const totalBags = body?.totalBags === null || body?.totalBags === undefined ? null : Number(body.totalBags);
    const grossWeight = body?.grossWeight === null || body?.grossWeight === undefined ? null : Number(body.grossWeight);
    const netWeight = body?.netWeight === null || body?.netWeight === undefined ? null : Number(body.netWeight);
    const weightUnit = typeof body?.weightUnit === "string" ? body.weightUnit.trim() : "";
    const remarks = typeof body?.remarks === "string" ? body.remarks.trim() : "";

    if (!jobId || !materialName) {
      return jsonError("Validation Error", "jobId and materialName are required fields.", 400);
    }

    if (quantityMode === "MULTI_WEIGHT" && totalBags !== null && totalBags < 1) {
      return jsonError("Validation Error", "Multi-weight lots must expect at least one weight row.", 400);
    }

    const access = await validateJobAccess(jobId, currentUser.companyId);
    if ("error" in access) {
      return access.error;
    }

    if (["CLOSED", "CANCELLED", "COMPLETED", "DISPATCHED", "LOCKED"].includes(access.job.status)) {
      return jsonError("Forbidden", "This job is not accepting new lot changes.", 403);
    }

    const workflowPolicy = await getWorkflowPolicy(currentUser.companyId);
    const lotNumber = workflowPolicy.workflow.autoLotNumbering
      ? await buildAutoLotNumber(
          jobId,
          currentUser.companyId,
          workflowPolicy.workflow.lotNumberPrefix,
          workflowPolicy.workflow.lotNumberSequenceFormat,
        )
      : requestedLotNumber;

    if (!lotNumber) {
      return jsonError("Validation Error", "lotNumber is required when auto lot numbering is disabled.", 400);
    }

    const lot = await prisma.$transaction(async (tx) => {
      const created = await tx.inspectionLot.create({
        data: {
          jobId,
          companyId: currentUser.companyId,
          lotNumber,
          materialName,
          materialCategory: materialCategory || null,
          quantityMode,
          bagCount,
          pieceCount,
          totalBags: deriveTotalBags({ quantityMode, bagCount, pieceCount, totalBags }),
          grossWeight,
          netWeight,
          weightUnit: weightUnit || null,
          remarks: remarks || null,
          status: mergeLotStatus(
            null,
            deriveLotStatus({ quantityMode, materialName, bagCount, pieceCount, grossWeight, netWeight }),
          ),
        },
        include: {
          bags: true,
          mediaFiles: true,
          sampling: true,
        },
      });

      await recordAuditLog(tx, {
        jobId,
        userId: currentUser.id,
        entity: "LOT",
        action: "LOT_CREATED",
        to: created.status,
        metadata: {
          lotId: created.id,
          lotNumber: created.lotNumber,
          materialName: created.materialName,
          quantityMode: created.quantityMode,
        },
      });

      if (created.quantityMode) {
        await recordAuditLog(tx, {
          jobId,
          userId: currentUser.id,
          entity: "LOT",
          action: "QUANTITY_MODE_SELECTED",
          to: created.quantityMode,
          metadata: {
            lotId: created.id,
            lotNumber: created.lotNumber,
          },
        });
      }

      await recomputeJobWorkflowMilestones(tx, {
        jobId,
        companyId: currentUser.companyId,
      });

      return created;
    });

    return NextResponse.json(lot);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }

    if (error && typeof error === "object" && "code" in error && String((error as { code?: unknown }).code) === "P2002") {
      return jsonError("Duplicate Lot Error", "Lot number already exists for this job.", 409);
    }

    const message = error instanceof Error ? error.message : "Internal Server Error";
    return jsonError("Failed to create lot", message, 500);
  }
}

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return jsonError("Validation Error", "jobId search parameter is required.", 400);
    }

    const access = await validateJobAccess(jobId, currentUser.companyId);
    if ("error" in access) {
      return access.error;
    }

    const lots = await prisma.inspectionLot.findMany({
      where: { jobId },
      orderBy: { createdAt: "asc" },
      include: {
        bags: {
          orderBy: { bagNumber: "asc" },
        },
        mediaFiles: {
          orderBy: { createdAt: "asc" },
        },
        sampling: true,
      },
    });

    return NextResponse.json(lots);
  } catch (err: unknown) {
    const error = err as Error;
    return jsonError("Failed to fetch lots", error.message || "Internal Server Error", 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "CREATE_LOT");

    const body = await req.json();
    const lotId = typeof body?.lotId === "string" ? body.lotId.trim() : "";
    const expectedUpdatedAtRaw = typeof body?.expectedUpdatedAt === "string" ? body.expectedUpdatedAt.trim() : "";
    if (!lotId) {
      return jsonError("Validation Error", "lotId is required.", 400);
    }
    if (!expectedUpdatedAtRaw) {
      return jsonError("Validation Error", "expectedUpdatedAt is required.", 400);
    }

    const expectedUpdatedAtResult = parseExpectedUpdatedAt(expectedUpdatedAtRaw);
    if (!expectedUpdatedAtResult.ok) {
      return jsonError("Validation Error", expectedUpdatedAtResult.message, 400);
    }
    const expectedUpdatedAt = expectedUpdatedAtResult.value;

    const existing = await prisma.inspectionLot.findUnique({
      where: { id: lotId },
      select: { id: true, jobId: true, companyId: true, status: true, quantityMode: true, materialName: true, updatedAt: true },
    });

    if (!existing || existing.companyId !== currentUser.companyId) {
      return jsonError("Forbidden", "Cross-company access is not allowed.", 403);
    }

    if (isLotVersionConflict(existing.updatedAt, expectedUpdatedAt)) {
      await enqueueWorkflowEscalationSafe({
        ...buildLotConflictEscalation({
          companyId: currentUser.companyId,
          raisedByUserId: currentUser.id,
          jobId: existing.jobId,
          lotId: existing.id,
          expectedUpdatedAt: expectedUpdatedAt.toISOString(),
          actualUpdatedAt: new Date(existing.updatedAt).toISOString(),
        }),
      });
      return jsonError(
        "Conflict Action",
        `Lot was updated by another action. Reload and retry with latest version (${new Date(existing.updatedAt).toISOString()}).`,
        409,
      );
    }

    const access = await validateJobAccess(existing.jobId, currentUser.companyId);
    if ("error" in access) {
      return access.error;
    }

    if (["CLOSED", "CANCELLED", "COMPLETED", "DISPATCHED", "LOCKED"].includes(access.job.status)) {
      return jsonError("Forbidden", "This job is not accepting lot changes.", 403);
    }

    const quantityMode = body?.quantityMode ? normalizeQuantityMode(String(body.quantityMode)) : normalizeQuantityMode(existing.quantityMode);
    const materialName = typeof body?.materialName === "string" ? body.materialName.trim() : undefined;
    const bagCount = body?.bagCount === undefined ? undefined : body.bagCount === null ? null : Number(body.bagCount);
    const pieceCount = body?.pieceCount === undefined ? undefined : body.pieceCount === null ? null : Number(body.pieceCount);
    const totalBags = body?.totalBags === undefined ? undefined : body.totalBags === null ? null : Number(body.totalBags);
    const grossWeight = body?.grossWeight === undefined ? undefined : body.grossWeight === null ? null : Number(body.grossWeight);
    const netWeight = body?.netWeight === undefined ? undefined : body.netWeight === null ? null : Number(body.netWeight);

    const lot = await prisma.$transaction(async (tx) => {
      const conditionalUpdate = await tx.inspectionLot.updateMany({
        where: {
          id: lotId,
          updatedAt: existing.updatedAt,
        },
        data: {
          ...(materialName !== undefined ? { materialName } : {}),
          ...(typeof body?.materialCategory === "string" ? { materialCategory: body.materialCategory.trim() || null } : {}),
          ...(body?.quantityMode !== undefined ? { quantityMode } : {}),
          ...(bagCount !== undefined ? { bagCount } : {}),
          ...(pieceCount !== undefined ? { pieceCount } : {}),
          ...(totalBags !== undefined
            ? { totalBags: deriveTotalBags({ quantityMode, bagCount: bagCount ?? undefined, pieceCount: pieceCount ?? undefined, totalBags }) }
            : {}),
          ...(grossWeight !== undefined ? { grossWeight } : {}),
          ...(netWeight !== undefined ? { netWeight } : {}),
          ...(typeof body?.weightUnit === "string" ? { weightUnit: body.weightUnit.trim() || null } : {}),
          ...(typeof body?.remarks === "string" ? { remarks: body.remarks.trim() || null } : {}),
          status: mergeLotStatus(
            existing.status,
            deriveLotStatus({
              quantityMode,
              materialName: materialName ?? existing.materialName ?? "",
              bagCount: bagCount ?? undefined,
              pieceCount: pieceCount ?? undefined,
              grossWeight: grossWeight ?? undefined,
              netWeight: netWeight ?? undefined,
            }),
          ),
        },
      });

      if (conditionalUpdate.count === 0) {
        const latestVersion = await tx.inspectionLot.findUnique({
          where: { id: lotId },
          select: { updatedAt: true },
        });

        await enqueueWorkflowEscalationSafe({
          ...buildLotConflictEscalation({
            companyId: currentUser.companyId,
            raisedByUserId: currentUser.id,
            jobId: existing.jobId,
            lotId: existing.id,
            expectedUpdatedAt: expectedUpdatedAt.toISOString(),
            actualUpdatedAt: latestVersion?.updatedAt
              ? new Date(latestVersion.updatedAt).toISOString()
              : new Date().toISOString(),
          }),
        }, tx);
        throw new Error("LOT_CONFLICT");
      }

      const updated = await tx.inspectionLot.findUnique({
        where: { id: lotId },
        include: {
          bags: true,
          mediaFiles: true,
          sampling: true,
        },
      });

      if (!updated) {
        throw new Error("LOT_NOT_FOUND_AFTER_UPDATE");
      }

      await recordAuditLog(tx, {
        jobId: existing.jobId,
        userId: currentUser.id,
        entity: "LOT",
        action: "LOT_EDITED",
        from: existing.status,
        to: updated.status,
        metadata: {
          lotId: updated.id,
          lotNumber: updated.lotNumber,
        },
      });

      return updated;
    });

    return NextResponse.json(lot);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }

    if (error instanceof Error && error.message === "LOT_CONFLICT") {
      return jsonError("Conflict Action", "Lot was updated by another action. Reload and retry.", 409);
    }

    const message = error instanceof Error ? error.message : "Internal Server Error";
    return jsonError("Failed to update lot", message, 500);
  }
}
