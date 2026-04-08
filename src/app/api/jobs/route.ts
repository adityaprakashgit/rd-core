import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { authorize, AuthorizationError } from "@/lib/rbac";
import { workspaceJobSelect } from "@/lib/job-workspace";
import { recordAuditLog } from "@/lib/audit";
import { evaluateDuplicateOverrideDecision } from "@/lib/job-duplicate-policy";
import { buildDuplicateJobEscalation, enqueueWorkflowEscalationSafe } from "@/lib/workflow-escalation";

export const dynamic = "force-dynamic";

function jsonError(message: string, details: string, status: number) {
  return NextResponse.json({ error: message, details }, { status });
}

function isAuthorizationError(error: unknown): error is AuthorizationError {
  return error instanceof AuthorizationError;
}

function normalizeMaterialType(value: unknown): "INHOUSE" | "TRADED" | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return normalized === "INHOUSE" || normalized === "TRADED" ? normalized : null;
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toSerializableDuplicate(input: {
  id: string;
  inspectionSerialNumber: string;
  jobReferenceNumber: string | null;
  clientName: string;
  commodity: string;
  plantLocation: string | null;
  status: string;
  createdAt: Date;
}) {
  return {
    id: input.id,
    inspectionSerialNumber: input.inspectionSerialNumber,
    jobReferenceNumber: input.jobReferenceNumber,
    clientName: input.clientName,
    commodity: input.commodity,
    plantLocation: input.plantLocation,
    status: input.status,
    createdAt: input.createdAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    const view = request.nextUrl.searchParams.get("view") ?? "my";

    if (view === "all") {
      authorize(currentUser, "VIEW_COMPANY_JOBS");
    } else if (view !== "my") {
      return jsonError("Invalid view", "view must be either my or all.", 400);
    }

    const includeArchived = request.nextUrl.searchParams.get("includeArchived") === "true";

    const where: Prisma.InspectionJobWhereInput = view === "all"
      ? { companyId: currentUser.companyId }
      : { companyId: currentUser.companyId, assignedToId: currentUser.id };

    if (!includeArchived) {
      where.status = { not: "ARCHIVED" };
    }

    const jobs = await prisma.inspectionJob.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      select: workspaceJobSelect,
    });

    return NextResponse.json(jobs);
  } catch (error: unknown) {
    if (isAuthorizationError(error)) {
      return jsonError("Forbidden", error.message, 403);
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonError("Failed to fetch jobs", message, 500);
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "CREATE_JOB");

    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null) {
      return jsonError("Invalid payload", "Request body must be a JSON object.", 400);
    }

    const payload = body as {
      clientId?: unknown;
      itemId?: unknown;
      clientName?: unknown;
      sourceName?: unknown;
      commodity?: unknown;
      materialCategory?: unknown;
      companyId?: unknown;
      userId?: unknown;
      plantLocation?: unknown;
      sourceLocation?: unknown;
      deadline?: unknown;
      materialType?: unknown;
      overrideDuplicate?: unknown;
      overrideReason?: unknown;
    };

    const sourceName = typeof payload.sourceName === "string" ? payload.sourceName : payload.clientName;
    const materialCategory = typeof payload.materialCategory === "string" ? payload.materialCategory : payload.commodity;
    const sourceLocation = typeof payload.sourceLocation === "string" ? payload.sourceLocation : payload.plantLocation;
    const materialType = normalizeMaterialType(payload.materialType);
    const clientId = normalizeText(payload.clientId);
    const itemId = normalizeText(payload.itemId);
    const deadline = normalizeText(payload.deadline);
    const overrideDuplicate = payload.overrideDuplicate === true;
    const overrideReason = normalizeText(payload.overrideReason);

    if (typeof sourceName !== "string" || typeof materialCategory !== "string") {
      return jsonError("Missing required fields", "sourceName/clientName and materialCategory/commodity are required.", 400);
    }

    const normalizedSourceName = sourceName.trim();
    const normalizedMaterialCategory = materialCategory.trim();
    const normalizedSourceLocation = normalizeText(sourceLocation);

    if (payload.companyId !== undefined && payload.companyId !== currentUser.companyId) {
      return jsonError("Forbidden", "companyId mismatch for current user.", 403);
    }

    if (payload.userId !== undefined && payload.userId !== currentUser.id) {
      return jsonError("Forbidden", "userId mismatch for current user.", 403);
    }

    const duplicateWindowHoursRaw = Number(process.env.JOB_DUPLICATE_WINDOW_HOURS ?? "24");
    const duplicateWindowHours = Number.isFinite(duplicateWindowHoursRaw) && duplicateWindowHoursRaw > 0
      ? duplicateWindowHoursRaw
      : 24;
    const duplicateWindowStart = new Date(Date.now() - duplicateWindowHours * 60 * 60 * 1000);

    const duplicateWhere: Prisma.InspectionJobWhereInput = {
      companyId: currentUser.companyId,
      status: { not: "ARCHIVED" },
      createdAt: { gte: duplicateWindowStart },
      clientName: { equals: normalizedSourceName, mode: "insensitive" },
      commodity: { equals: normalizedMaterialCategory, mode: "insensitive" },
      ...(normalizedSourceLocation
        ? { plantLocation: { equals: normalizedSourceLocation, mode: "insensitive" } }
        : { plantLocation: null }),
    };

    const duplicateCandidates = await prisma.inspectionJob.findMany({
      where: duplicateWhere,
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        inspectionSerialNumber: true,
        jobReferenceNumber: true,
        clientName: true,
        commodity: true,
        plantLocation: true,
        status: true,
        createdAt: true,
      },
    });

    const duplicateDecision = evaluateDuplicateOverrideDecision({
      duplicates: duplicateCandidates,
      duplicateWindowHours,
      overrideDuplicate,
      overrideReason,
      userRole: currentUser.role,
    });

    if (duplicateDecision.kind === "BLOCK_DUPLICATE") {
      await enqueueWorkflowEscalationSafe({
        ...buildDuplicateJobEscalation({
          companyId: currentUser.companyId,
          raisedByUserId: currentUser.id,
          sourceName: normalizedSourceName,
          materialCategory: normalizedMaterialCategory,
          sourceLocation: normalizedSourceLocation,
          duplicateWindowHours,
          duplicateCandidates,
          overrideRequested: false,
        }),
      });

      return NextResponse.json(
        {
          error: "Duplicate Warning",
          details: "Potential duplicate jobs found for the same source/material in the recent window. Re-submit with overrideDuplicate=true to continue.",
          code: "JOB_POTENTIAL_DUPLICATE",
          duplicateWindowHours: duplicateDecision.duplicateWindowHours,
          canOverrideDuplicate: duplicateDecision.canOverrideDuplicate,
          duplicateCandidates: duplicateDecision.duplicates.map(toSerializableDuplicate),
          duplicates: duplicateDecision.duplicates.map(toSerializableDuplicate),
        },
        { status: 409 },
      );
    }

    if (duplicateDecision.kind === "VALIDATION_ERROR") {
      return jsonError("Validation Error", duplicateDecision.message, 400);
    }

    if (duplicateDecision.kind === "FORBIDDEN_OVERRIDE") {
      return jsonError("Forbidden", duplicateDecision.message, 403);
    }

    if (duplicateDecision.kind === "ALLOW_OVERRIDE") {
      authorize(currentUser, "OVERRIDE_DUPLICATE_JOB");
    }

    const deadlineDate = deadline ? new Date(deadline) : null;
    if (deadline && (!deadlineDate || Number.isNaN(deadlineDate.getTime()))) {
      return jsonError("Validation Error", "deadline must be a valid date.", 400);
    }

    const { generateInspectionSerial } = await import("@/lib/serial");
    const serial = await generateInspectionSerial();

    const job = await prisma.$transaction(async (tx) => {
      const created = await tx.inspectionJob.create({
        data: {
          companyId: currentUser.companyId,
          createdByUserId: currentUser.id,
          assignedToId: currentUser.id,
          assignedById: currentUser.id,
          assignedAt: new Date(),
          clientId,
          itemId,
          deadline: deadlineDate,
          clientName: normalizedSourceName,
          commodity: normalizedMaterialCategory,
          plantLocation: normalizedSourceLocation
            ? normalizedSourceLocation
            : null,
          inspectionSerialNumber: serial ?? "",
        },
        select: workspaceJobSelect,
      });

      await recordAuditLog(tx, {
        jobId: created.id,
        userId: currentUser.id,
        entity: "JOB",
        action: "JOB_CREATED",
        to: "CREATED",
        metadata: {
          sourceName: created.clientName,
          materialCategory: created.commodity,
          materialType,
          ...duplicateDecision.auditMetadata,
        },
      });

      if (duplicateDecision.kind === "ALLOW_OVERRIDE") {
        await recordAuditLog(tx, {
          jobId: created.id,
          userId: currentUser.id,
          entity: "JOB",
          action: "JOB_DUPLICATE_OVERRIDE_USED",
          to: "CREATED",
          notes: duplicateDecision.overrideReason,
          metadata: {
            duplicateCandidateCount: duplicateCandidates.length,
            duplicateCandidateIds: duplicateCandidates.map((candidate) => candidate.id),
            duplicateWindowHours,
          },
        });
      }

      return created;
    });

    return NextResponse.json(job);
  } catch (error: unknown) {
    if (isAuthorizationError(error)) {
      return jsonError("Forbidden", error.message, 403);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return jsonError("Database error", error.message, 500);
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonError("Failed to create job", message, 500);
  }
}
