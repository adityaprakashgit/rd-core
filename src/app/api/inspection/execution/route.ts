import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit";
import {
  buildDecisionValidation,
  buildMasterSeedPayload,
  deriveInspectionAssessment,
  getSuggestedIssueCategoriesFromResponses,
  isExceptionResponse,
  LEGACY_DEFAULT_INSPECTION_ITEM_KEYS,
} from "@/lib/inspection-checklist";
import { getIssueDraftValidationErrors } from "@/lib/inspection-workspace";
import {
  getRequiredProofFailureCode,
  resolveEvidenceCategoriesForLot,
  resolveMissingRequiredEvidenceCategories,
  requiresRequiredImageProofForDecision,
  resolveRequiredImageUploadCategories,
} from "@/lib/image-proof-policy";
import {
  getEvidenceCategoryLabel,
  normalizeEvidenceCategoryKey,
  type CanonicalEvidenceCategory,
} from "@/lib/evidence-definition";
import { buildModuleWorkflowSettingsCreate, canApproveFinalDecision, toModuleWorkflowPolicy } from "@/lib/module-workflow-policy";
import { prisma } from "@/lib/prisma";
import { authorize, AuthorizationError } from "@/lib/rbac";
import { getCurrentUserFromRequest } from "@/lib/session";
import { recomputeJobWorkflowMilestones } from "@/lib/workflow-milestones";
import type {
  InspectionChecklistResponse,
  InspectionDecisionStatus,
  InspectionIssue,
} from "@/types/inspection";

export const dynamic = "force-dynamic";

type PrismaLike = Prisma.TransactionClient | typeof prisma;

const inspectionInclude = {
  responses: {
    orderBy: { displayOrder: "asc" },
    include: {
      checklistItemMaster: true,
    },
  },
  issues: {
    orderBy: { createdAt: "asc" },
  },
  mediaFiles: {
    orderBy: { createdAt: "asc" },
  },
} as const;


function jsonError(error: string, details: string, status: number, code = "INSPECTION_EXECUTION_ERROR") {
  return NextResponse.json({ error, details, code }, { status });
}

function mapDecisionOutcome(decisionStatus: InspectionDecisionStatus | string | null | undefined) {
  if (decisionStatus === "READY_FOR_SAMPLING") {
    return "PASS";
  }
  if (decisionStatus === "ON_HOLD") {
    return "HOLD";
  }
  if (decisionStatus === "REJECTED") {
    return "REJECT";
  }
  return null;
}

function mergeCanonicalMediaCategories(
  ...sources: Array<Array<{ category?: string | null }> | null | undefined>
) {
  const categories = new Set<CanonicalEvidenceCategory>();
  for (const source of sources) {
    for (const media of source ?? []) {
      const normalized = normalizeEvidenceCategoryKey(media?.category);
      if (normalized) {
        categories.add(normalized);
      }
    }
  }
  return Array.from(categories);
}

async function ensureChecklistSeeded(tx: PrismaLike) {
  const defaults = buildMasterSeedPayload();
  const defaultKeys = new Set(defaults.map((item) => item.itemKey));

  for (const item of defaults) {
    await tx.inspectionChecklistItemMaster.upsert({
      where: { itemKey: item.itemKey },
      create: item,
      update: {
        isRequired: item.isRequired,
        isActive: true,
      },
    });
  }

  const deprecatedDefaultKeys = LEGACY_DEFAULT_INSPECTION_ITEM_KEYS.filter((itemKey) => !defaultKeys.has(itemKey));
  if (deprecatedDefaultKeys.length > 0) {
    await tx.inspectionChecklistItemMaster.updateMany({
      where: {
        itemKey: {
          in: deprecatedDefaultKeys,
        },
      },
      data: {
        isActive: false,
      },
    });
  }
}

async function getLotScope(tx: PrismaLike, lotId: string, companyId: string) {
  const lot = await tx.inspectionLot.findUnique({
    where: { id: lotId },
    select: {
      id: true,
      jobId: true,
      companyId: true,
      lotNumber: true,
      materialName: true,
      materialCategory: true,
      totalBags: true,
      bagCount: true,
      pieceCount: true,
      weightUnit: true,
      remarks: true,
      status: true,
      bagPhotoUrl: true,
      samplingPhotoUrl: true,
      sealPhotoUrl: true,
      mediaFiles: {
        select: {
          category: true,
        },
      },
      createdAt: true,
      updatedAt: true,
      job: {
        select: {
          id: true,
          clientName: true,
          commodity: true,
          status: true,
        },
      },
    },
  });

  if (!lot || lot.companyId !== companyId) {
    throw new AuthorizationError("Cross-company access is not allowed.");
  }

  return lot;
}

async function buildInspectionPayload(tx: PrismaLike, lotId: string, companyId: string) {
  await ensureChecklistSeeded(tx);
  const workflowPolicy = await getWorkflowPolicy(tx, companyId);
  const requiredMediaCategories = resolveRequiredImageUploadCategories(workflowPolicy.images.requiredImageCategories);
  const lot = await getLotScope(tx, lotId, companyId);
  const checklistItems = await tx.inspectionChecklistItemMaster.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
  });
  const inspection = await tx.inspection.findUnique({
    where: { lotId },
    include: inspectionInclude,
  });

  const assessment = inspection
    ? deriveInspectionAssessment({
        items: checklistItems,
        responses: inspection.responses as InspectionChecklistResponse[],
        issues: inspection.issues as InspectionIssue[],
        mediaCategories: mergeCanonicalMediaCategories(inspection.mediaFiles, lot.mediaFiles),
        requiredMediaCategories,
      })
    : null;

  const suggestedIssueCategories = inspection
    ? getSuggestedIssueCategoriesFromResponses(checklistItems, inspection.responses as InspectionChecklistResponse[])
    : [];

  return {
    lot,
    checklistItems,
    inspection,
    assessment,
    suggestedIssueCategories,
  };
}

async function getWorkflowPolicy(tx: PrismaLike, companyId: string) {
  const settings = await tx.moduleWorkflowSettings.upsert({
    where: { companyId },
    update: {},
    create: buildModuleWorkflowSettingsCreate(companyId),
  });
  return toModuleWorkflowPolicy(settings);
}

function normalizeDecisionStatus(value: unknown): InspectionDecisionStatus | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  switch (value) {
    case "PENDING":
    case "READY_FOR_SAMPLING":
    case "ON_HOLD":
    case "REJECTED":
      return value;
    default:
      return undefined;
  }
}

function normalizeResponseValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeIssues(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((issue) => {
      if (!issue || typeof issue !== "object") {
        return null;
      }

      const raw = issue as Record<string, unknown>;
      const issueCategory = typeof raw.issueCategory === "string" ? raw.issueCategory.trim() : "";
      const severity = typeof raw.severity === "string" ? raw.severity.trim().toUpperCase() : "";
      const description = typeof raw.description === "string" ? raw.description.trim() : "";
      const status = typeof raw.status === "string" && raw.status.trim().length > 0 ? raw.status.trim().toUpperCase() : "OPEN";

      if (!issueCategory || !severity || !description) {
        return null;
      }

      return {
        issueCategory,
        severity,
        description,
        status,
      };
    })
    .filter((issue): issue is NonNullable<typeof issue> => Boolean(issue));
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    const lotId = request.nextUrl.searchParams.get("lotId");
    if (!lotId) {
      return jsonError("Validation Error", "lotId is required.", 400);
    }

    const payload = await buildInspectionPayload(prisma, lotId, currentUser.companyId);
    return NextResponse.json(payload);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }

    const message = error instanceof Error ? error.message : "Failed to load inspection execution.";
    return jsonError("System Error", message, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "CREATE_LOT");

    const body = await request.json();
    const lotId = typeof body?.lotId === "string" ? body.lotId.trim() : "";
    if (!lotId) {
      return jsonError("Validation Error", "lotId is required.", 400);
    }

    const payload = await prisma.$transaction(async (tx) => {
      const lot = await getLotScope(tx, lotId, currentUser.companyId);

      if (lot.job.status === "LOCKED") {
        throw new Error("JOB_LOCKED");
      }

      await ensureChecklistSeeded(tx);

      let inspection = await tx.inspection.findUnique({
        where: { lotId },
        include: inspectionInclude,
      });

      if (!inspection) {
        inspection = await tx.inspection.create({
          data: {
            jobId: lot.jobId,
            lotId,
            inspectorId: currentUser.id,
            inspectionStatus: "IN_PROGRESS",
            decisionStatus: "PENDING",
          },
          include: inspectionInclude,
        });

        await tx.inspectionLot.update({
          where: { id: lotId },
          data: { status: "INSPECTION_IN_PROGRESS" },
        });

        await recordAuditLog(tx, {
          jobId: lot.jobId,
          userId: currentUser.id,
          entity: "INSPECTION",
          action: "INSPECTION_STARTED",
          to: "IN_PROGRESS",
          metadata: {
            lotId,
            inspectionId: inspection.id,
          },
        });
      }

      return buildInspectionPayload(tx, lotId, currentUser.companyId);
    });

    return NextResponse.json(payload);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }

    const message = error instanceof Error ? error.message : "Failed to start inspection.";
    if (message === "JOB_LOCKED") {
      return jsonError("Forbidden", "This job is LOCKED. No inspection changes are allowed.", 403);
    }

    return jsonError("System Error", message, 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "CREATE_LOT");

    const body = await request.json();
    const lotId = typeof body?.lotId === "string" ? body.lotId.trim() : "";
    if (!lotId) {
      return jsonError("Validation Error", "lotId is required.", 400);
    }

    const decisionStatus = normalizeDecisionStatus(body?.decisionStatus);
    const overallRemark = normalizeText(body?.overallRemark);
    const responsesProvided = Array.isArray(body?.responses);
    const issuesProvided = Array.isArray(body?.issues);
    const rawResponses = responsesProvided ? body.responses : [];
    const rawIssueEntries = issuesProvided ? body.issues : [];
    const normalizedIssues = normalizeIssues(body?.issues);
    const overallRemarkProvided = Object.prototype.hasOwnProperty.call(body ?? {}, "overallRemark");

    const payload = await prisma.$transaction(async (tx) => {
      const workflowPolicy = await getWorkflowPolicy(tx, currentUser.companyId);
      const lot = await getLotScope(tx, lotId, currentUser.companyId);
      if (lot.job.status === "LOCKED") {
        throw new Error("JOB_LOCKED");
      }
      if (decisionStatus && decisionStatus !== "PENDING" && !canApproveFinalDecision(currentUser.role, workflowPolicy.workflow.finalDecisionApproverPolicy)) {
        throw new Error("DECISION_APPROVER_REQUIRED");
      }
      if (
        (decisionStatus === "ON_HOLD" || decisionStatus === "REJECTED") &&
        workflowPolicy.approval.holdRejectNotesMandatory &&
        !overallRemark
      ) {
        throw new Error("DECISION_NOTE_REQUIRED");
      }


      await ensureChecklistSeeded(tx);
      const checklistItems = await tx.inspectionChecklistItemMaster.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: "asc" },
      });
      const checklistMap = new Map(checklistItems.map((item) => [item.id, item]));

      let inspection = await tx.inspection.findUnique({
        where: { lotId },
        include: inspectionInclude,
      });

      if (!inspection) {
        inspection = await tx.inspection.create({
          data: {
            jobId: lot.jobId,
            lotId,
            inspectorId: currentUser.id,
            inspectionStatus: "IN_PROGRESS",
            decisionStatus: "PENDING",
          },
          include: inspectionInclude,
        });

        await recordAuditLog(tx, {
          jobId: lot.jobId,
          userId: currentUser.id,
          entity: "INSPECTION",
          action: "INSPECTION_STARTED",
          to: "IN_PROGRESS",
          metadata: {
            lotId,
            inspectionId: inspection.id,
          },
        });
      }

      if (responsesProvided) {
        for (const entry of rawResponses) {
          if (!entry || typeof entry !== "object") {
            continue;
          }

          const responseEntry = entry as Record<string, unknown>;
          const checklistItemMasterId =
            typeof responseEntry.checklistItemMasterId === "string" ? responseEntry.checklistItemMasterId.trim() : "";
          const item = checklistMap.get(checklistItemMasterId);

          if (!item) {
            continue;
          }

          const responseValue = normalizeResponseValue(responseEntry.responseValue);
          const responseText = normalizeText(responseEntry.responseText);
          const isException = Boolean(responseValue) && isExceptionResponse(item.itemKey, responseValue);

          await tx.inspectionChecklistResponse.upsert({
            where: {
              inspectionId_checklistItemMasterId: {
                inspectionId: inspection.id,
                checklistItemMasterId,
              },
            },
            create: {
              inspectionId: inspection.id,
              checklistItemMasterId,
              sectionName: item.sectionName,
              itemLabel: item.itemLabel,
            responseValue,
            responseText,
            isException,
            displayOrder: item.displayOrder,
          },
            update: {
              responseValue,
              responseText,
              isException,
              recordedAt: new Date(),
            },
          });
        }

        await recordAuditLog(tx, {
          jobId: lot.jobId,
          userId: currentUser.id,
          entity: "INSPECTION",
          action: "CHECKLIST_RESPONSE_SAVED",
          metadata: {
            lotId,
            inspectionId: inspection.id,
            responseCount: rawResponses.length,
          },
        });
      }

      if (issuesProvided) {
        await tx.inspectionIssue.deleteMany({
          where: { inspectionId: inspection.id },
        });
      }

      if (issuesProvided && normalizedIssues.length > 0) {
        await tx.inspectionIssue.createMany({
          data: normalizedIssues.map((issue) => ({
            inspectionId: inspection.id,
            issueCategory: issue.issueCategory,
            severity: issue.severity,
            description: issue.description,
            status: issue.status,
          })),
        });

        await recordAuditLog(tx, {
          jobId: lot.jobId,
          userId: currentUser.id,
          entity: "INSPECTION",
          action: "ISSUE_CREATED",
          metadata: {
            lotId,
            inspectionId: inspection.id,
            issueCount: normalizedIssues.length,
          },
        });
      }

      const refreshed = await tx.inspection.findUniqueOrThrow({
        where: { id: inspection.id },
        include: inspectionInclude,
      });

      const assessment = deriveInspectionAssessment({
        items: checklistItems,
        responses: refreshed.responses as InspectionChecklistResponse[],
        issues: refreshed.issues as InspectionIssue[],
        mediaCategories: mergeCanonicalMediaCategories(refreshed.mediaFiles, lot.mediaFiles),
        requiredMediaCategories: resolveRequiredImageUploadCategories(workflowPolicy.images.requiredImageCategories),
      });
      const resolvedEvidence = resolveEvidenceCategoriesForLot({
        lot,
        inspectionMedia: refreshed.mediaFiles,
        lotMedia: lot.mediaFiles,
      });
      const missingRequiredCategories = resolveMissingRequiredEvidenceCategories(
        workflowPolicy.images.requiredImageCategories,
        resolvedEvidence,
      );

      const nextOverallRemark = overallRemarkProvided ? overallRemark : refreshed.overallRemark;
      const nextDecisionStatus = decisionStatus ?? (refreshed.decisionStatus as InspectionDecisionStatus);
      const issueDraftErrors =
        nextDecisionStatus && nextDecisionStatus !== "PENDING"
          ? getIssueDraftValidationErrors(
              Array.isArray(rawIssueEntries)
                ? rawIssueEntries.map((issue) => {
                    const raw = issue && typeof issue === "object" ? (issue as Record<string, unknown>) : {};
                    return {
                      issueCategory: typeof raw.issueCategory === "string" ? raw.issueCategory.trim() : "",
                      severity: typeof raw.severity === "string" ? raw.severity.trim() : "",
                      description: typeof raw.description === "string" ? raw.description.trim() : "",
                      status: typeof raw.status === "string" ? raw.status.trim() : "OPEN",
                    };
                  })
                : [],
            )
          : [];
      const validationErrors = nextDecisionStatus
        ? buildDecisionValidation({
            decisionStatus: nextDecisionStatus,
            assessment,
            issues: refreshed.issues as InspectionIssue[],
            overallRemark: nextOverallRemark,
          })
        : [];

      if ((issueDraftErrors.length > 0 || validationErrors.length > 0) && nextDecisionStatus !== "PENDING") {
        throw new Error(`VALIDATION:${[...issueDraftErrors, ...validationErrors].join(" ")}`);
      }
      if (requiresRequiredImageProofForDecision(decisionStatus) && missingRequiredCategories.length > 0) {
        throw new Error(`PROOF_REQUIRED:${missingRequiredCategories.join(" | ")}`);
      }

      const nextInspectionStatus = nextDecisionStatus && nextDecisionStatus !== "PENDING" ? "COMPLETED" : "IN_PROGRESS";
      const nextLotStatus =
        nextDecisionStatus && nextDecisionStatus !== "PENDING" ? nextDecisionStatus : "INSPECTION_IN_PROGRESS";

      await tx.inspection.update({
        where: { id: inspection.id },
        data: {
          ...(overallRemarkProvided ? { overallRemark: nextOverallRemark } : {}),
          decisionStatus: nextDecisionStatus ?? "PENDING",
          ...(decisionStatus === "PENDING" && !inspection.sentToAdminAt
            ? {
                sentToAdminAt: new Date(),
                sentToAdminBy: currentUser.id,
              }
            : {}),
          ...(decisionStatus && decisionStatus !== "PENDING"
            ? {
                decisionAt: new Date(),
                decisionBy: currentUser.id,
                decisionOutcome: mapDecisionOutcome(decisionStatus),
              }
            : {}),
          inspectionStatus: nextInspectionStatus,
          completedAt: nextInspectionStatus === "COMPLETED" ? new Date() : null,
          identityRiskFlag: assessment.identityRiskFlag,
          packagingRiskFlag: assessment.packagingRiskFlag,
          materialRiskFlag: assessment.materialRiskFlag,
          samplingBlockedFlag: assessment.samplingBlockedFlag,
          issueCount: assessment.issueCount,
        },
      });

      await tx.inspectionLot.update({
        where: { id: lotId },
        data: { status: nextLotStatus },
      });

      if (decisionStatus) {
        await recordAuditLog(tx, {
          jobId: lot.jobId,
          userId: currentUser.id,
          entity: "INSPECTION",
          action: "DECISION_SELECTED",
          to: decisionStatus,
          metadata: {
            lotId,
            inspectionId: inspection.id,
          },
        });
      }

      if (nextInspectionStatus === "COMPLETED") {
        await recordAuditLog(tx, {
          jobId: lot.jobId,
          userId: currentUser.id,
          entity: "INSPECTION",
          action: "INSPECTION_COMPLETED",
          to: nextDecisionStatus ?? "PENDING",
          metadata: {
            lotId,
            inspectionId: inspection.id,
            samplingBlockedFlag: assessment.samplingBlockedFlag,
          },
        });

        await recordAuditLog(tx, {
          jobId: lot.jobId,
          userId: currentUser.id,
          entity: "LOT",
          action: "LOT_STATUS_UPDATED",
          from: lot.status,
          to: nextLotStatus,
          metadata: {
            lotId,
            inspectionId: inspection.id,
          },
        });
      }

      await recomputeJobWorkflowMilestones(tx, {
        jobId: lot.jobId,
        companyId: currentUser.companyId,
      });

      return buildInspectionPayload(tx, lotId, currentUser.companyId);
    });

    return NextResponse.json(payload);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }

    const message = error instanceof Error ? error.message : "Failed to save inspection.";
    if (message === "JOB_LOCKED") {
      return jsonError("Forbidden", "This job is LOCKED. No inspection changes are allowed.", 403, "INSPECTION_JOB_LOCKED");
    }
    if (message.startsWith("VALIDATION:")) {
      return jsonError("Validation Error", message.replace("VALIDATION:", "").trim(), 422, "INSPECTION_VALIDATION_FAILED");
    }
    if (message.startsWith("PROOF_REQUIRED:")) {
      const missingCategories = message
        .replace("PROOF_REQUIRED:", "")
        .trim()
        .split(" | ")
        .map((entry) => normalizeEvidenceCategoryKey(entry))
        .filter((entry): entry is CanonicalEvidenceCategory => Boolean(entry));
      const missingLabels = missingCategories.map((entry) => getEvidenceCategoryLabel(entry));
      return jsonError(
        "Validation Error",
        `Upload required proof before submission: ${missingLabels.join(", ")}.`,
        422,
        getRequiredProofFailureCode(missingCategories),
      );
    }
    if (message === "DECISION_APPROVER_REQUIRED") {
      return jsonError("Forbidden", "Only the configured Manager/Admin approver can pass, hold, or reject the final decision.", 403, "DECISION_APPROVER_REQUIRED");
    }
    if (message === "DECISION_NOTE_REQUIRED") {
      return jsonError("Validation Error", "Notes are required for Hold and Reject decisions.", 400, "DECISION_NOTE_REQUIRED");
    }

    return jsonError("System Error", message, 500, "INSPECTION_PATCH_FAILED");
  }
}
