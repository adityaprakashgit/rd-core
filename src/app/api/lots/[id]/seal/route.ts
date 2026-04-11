import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { getEvidenceCategoryLabel } from "@/lib/evidence-definition";
import {
  getRequiredProofFailureCode,
  resolveEvidenceCategoriesForLot,
  resolveMissingRequiredEvidenceCategories,
} from "@/lib/image-proof-policy";
import { buildModuleWorkflowSettingsCreate, toModuleWorkflowPolicy } from "@/lib/module-workflow-policy";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { authorize, assertCompanyScope, AuthorizationError } from "@/lib/rbac";
import { generateUniqueSealNumber, isValidSealNumber } from "@/lib/traceability";
import { recomputeJobWorkflowMilestones } from "@/lib/workflow-milestones";
import { evaluateSealAssignmentPrerequisites, getSealAssignmentPolicy } from "@/lib/seal-policy";

function jsonError(error: string, details: string, code: string, status: number) {
  return NextResponse.json({ error, details, code }, { status });
}

async function createAuditSafe(tx: Prisma.TransactionClient, input: {
  jobId: string;
  userId: string;
  action: "SEAL_GENERATED" | "SEAL_ASSIGNED";
  sealNumber: string;
  sealAuto: boolean;
}) {
  try {
    await tx.auditLog.create({
      data: {
        jobId: input.jobId,
        userId: input.userId,
        entity: "LOT",
        action: input.action,
        metadata: {
          sealNumber: input.sealNumber,
          sealAuto: input.sealAuto,
        },
      },
    });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      return;
    }
    throw error;
  }
}

type LotSealRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: LotSealRouteContext) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", "AUTH_UNAUTHORIZED", 401);
    }

    authorize(currentUser, "ASSIGN_LOT");

    const { id } = await context.params;
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null) {
      return jsonError("Invalid payload", "Request body must be a JSON object.", "SEAL_INVALID_PAYLOAD", 400);
    }

    const payload = body as {
      sealNumber?: unknown;
      auto?: unknown;
    };

    const lot = await prisma.inspectionLot.findUnique({
      where: { id },
      select: {
        id: true,
        jobId: true,
        companyId: true,
        lotNumber: true,
        sealNumber: true,
        bagPhotoUrl: true,
        samplingPhotoUrl: true,
        sealPhotoUrl: true,
        mediaFiles: {
          select: {
            category: true,
          },
        },
        job: {
          select: {
            status: true,
          },
        },
        inspection: {
          select: {
            inspectionStatus: true,
            decisionStatus: true,
            mediaFiles: {
              select: {
                category: true,
              },
            },
          },
        },
      },
    });

    if (!lot) {
      return jsonError("Not found", "Lot not found.", "SEAL_LOT_NOT_FOUND", 404);
    }

    assertCompanyScope(currentUser.companyId, lot.companyId);

    if (lot.sealNumber) {
      return jsonError("Conflict", "This seal number is immutable once assigned.", "SEAL_ALREADY_ASSIGNED", 409);
    }

    const resolvedCategories = resolveEvidenceCategoriesForLot({
      lot,
      lotMedia: lot.mediaFiles,
      inspectionMedia: lot.inspection?.mediaFiles,
    });
    const sealPolicy = getSealAssignmentPolicy();
    const prerequisiteBlock = evaluateSealAssignmentPrerequisites({
      policy: sealPolicy,
      jobStatus: lot.job?.status,
      inspectionStatus: lot.inspection?.inspectionStatus,
      decisionStatus: lot.inspection?.decisionStatus,
      bagPhotoUrl: resolvedCategories.has("BAG_WITH_LOT_NO") ? "available" : null,
      samplingPhotoUrl: resolvedCategories.has("SAMPLING_IN_PROGRESS") ? "available" : null,
    });
    if (prerequisiteBlock) {
      return jsonError("Validation Error", prerequisiteBlock.details, prerequisiteBlock.code, prerequisiteBlock.status);
    }

    if (sealPolicy === "EVIDENCE_READY") {
      const settings = await prisma.moduleWorkflowSettings.upsert({
        where: { companyId: currentUser.companyId },
        update: {},
        create: buildModuleWorkflowSettingsCreate(currentUser.companyId),
      });
      const workflowPolicy = toModuleWorkflowPolicy(settings);
      const missingRequired = resolveMissingRequiredEvidenceCategories(
        workflowPolicy.images.requiredImageCategories,
        resolvedCategories,
      );
      if (missingRequired.length > 0) {
        const missingLabels = missingRequired.map((category) => getEvidenceCategoryLabel(category));
        return jsonError(
          "Validation Error",
          `Upload required proof before seal assignment: ${missingLabels.join(", ")}.`,
          getRequiredProofFailureCode(missingRequired),
          422,
        );
      }
    }

    const useAuto = payload.auto === true;
    const manualSeal = typeof payload.sealNumber === "string" ? payload.sealNumber.trim() : "";
    const sealNumber = useAuto ? await generateUniqueSealNumber() : manualSeal;

    if (!isValidSealNumber(sealNumber)) {
      return jsonError("Validation Error", "Seal number must be exactly 16 numeric digits.", "SEAL_FORMAT_INVALID", 400);
    }

    const duplicateSeal = await prisma.inspectionLot.findFirst({
      where: { sealNumber },
      select: { id: true },
    });

    if (duplicateSeal) {
      return jsonError("Conflict", "Seal number already exists.", "SEAL_DUPLICATE", 409);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.inspectionLot.update({
        where: { id: lot.id },
        data: {
          sealNumber,
          sealAuto: useAuto,
        },
        select: {
          id: true,
          lotNumber: true,
          sealNumber: true,
          sealAuto: true,
          companyId: true,
        },
      });

      if (useAuto) {
        await createAuditSafe(tx, {
          jobId: lot.jobId,
          userId: currentUser.id,
          action: "SEAL_GENERATED",
          sealNumber,
          sealAuto: true,
        });
      }

      await createAuditSafe(tx, {
        jobId: lot.jobId,
        userId: currentUser.id,
        action: "SEAL_ASSIGNED",
        sealNumber,
        sealAuto: useAuto,
      });

      await recomputeJobWorkflowMilestones(tx, {
        jobId: lot.jobId,
        companyId: currentUser.companyId,
      });

      return result;
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, "SEAL_CROSS_COMPANY_FORBIDDEN", 403);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return jsonError("Conflict", "Seal number already exists.", "SEAL_DUPLICATE", 409);
      }
    }

    const message = error instanceof Error ? error.message : "Failed to assign seal.";
    return jsonError("System Error", message, "SEAL_ASSIGN_FAILED", 500);
  }
}
