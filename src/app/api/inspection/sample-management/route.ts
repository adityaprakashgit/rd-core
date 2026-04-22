import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit";
import {
  buildSampleCode,
  deriveSampleStatusWithContext,
  getSampleReadiness,
  hasHomogenizedSample,
  hasSampleDetails,
  hasSealAndLabel,
  isInspectionReadyForSampling,
  normalizeSampleMediaType,
} from "@/lib/sample-management";
import { syncSampleSealTraceability } from "@/lib/sample-seal-traceability";
import {
  buildModuleWorkflowSettingsCreate,
  canEditSealWithRoles,
  toModuleWorkflowPolicy,
} from "@/lib/module-workflow-policy";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { recomputeJobWorkflowMilestones } from "@/lib/workflow-milestones";
import type { SampleRecord } from "@/types/inspection";

export const dynamic = "force-dynamic";

type PrismaLike = Prisma.TransactionClient | typeof prisma;

const publicUserSelect = {
  select: {
    profile: {
      select: {
        displayName: true,
        companyName: true,
        avatarUrl: true,
        jobTitle: true,
      },
    },
    role: true,
  },
} as const;

const sampleInclude = {
  createdBy: publicUserSelect,
  sealLabel: true,
  events: {
    orderBy: { eventTime: "asc" },
    include: {
      performedBy: publicUserSelect,
    },
  },
  media: {
    orderBy: { capturedAt: "asc" },
    include: {
      capturedBy: publicUserSelect,
    },
  },
} as const;

function jsonError(error: string, details: string, status: number) {
  return NextResponse.json({ error, details }, { status });
}

function logLotIdCompatibilityUsage(input: {
  route: string;
  caller?: string | null;
  hasJobId: boolean;
  hasLotId: boolean;
}) {
  console.warn(
    JSON.stringify({
      event: "deprecated_lot_id_compat",
      route: input.route,
      caller: input.caller ?? "unknown",
      hasJobId: input.hasJobId,
      hasLotId: input.hasLotId,
      message: "jobId is canonical; lotId-only payload is deprecated compatibility input.",
    }),
  );
}

function normalizeText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

async function createSampleEvent(
  tx: Prisma.TransactionClient,
  input: {
    sampleId: string;
    eventType: string;
    performedById?: string | null;
    remarks?: string | null;
    metadata?: Prisma.InputJsonValue;
  },
) {
  await tx.sampleEvent.create({
    data: {
      sampleId: input.sampleId,
      eventType: input.eventType,
      performedById: input.performedById ?? null,
      remarks: input.remarks ?? null,
      metadata: input.metadata,
    },
  });
}

async function getSamplingScope(
  tx: PrismaLike,
  input: { jobId?: string | null; lotId?: string | null; companyId: string; requireDecisionApproval?: boolean },
) {
  const requestedJobId = input.jobId?.trim() ?? "";
  const requestedLotId = input.lotId?.trim() ?? "";

  if (!requestedJobId && !requestedLotId) {
    throw new Error("JOB_ID_REQUIRED");
  }

  const lotSelect = {
    id: true,
    jobId: true,
    companyId: true,
    lotNumber: true,
    sealNumber: true,
    status: true,
    bagPhotoUrl: true,
    sealPhotoUrl: true,
    samplingPhotoUrl: true,
    job: {
      select: {
        id: true,
        companyId: true,
        inspectionSerialNumber: true,
        status: true,
        finalDecisionStatus: true,
      },
    },
    inspection: {
      select: {
        id: true,
        inspectionStatus: true,
        decisionStatus: true,
      },
    },
  } satisfies Prisma.InspectionLotSelect;

  const lotById = requestedLotId
    ? await tx.inspectionLot.findUnique({
        where: { id: requestedLotId },
        select: lotSelect,
      })
    : null;

  const resolvedJobId = requestedJobId || lotById?.jobId || "";
  if (!resolvedJobId) {
    throw new Error("JOB_ID_REQUIRED");
  }

  const lot = lotById
    ? lotById
    : await tx.inspectionLot.findFirst({
        where: { jobId: resolvedJobId, companyId: input.companyId },
        orderBy: { createdAt: "asc" },
        select: lotSelect,
      });

  if (!lot || lot.companyId !== input.companyId) {
    throw new Error("FORBIDDEN");
  }

  if (lot.job.status === "LOCKED") {
    throw new Error("JOB_LOCKED");
  }

  if (input.requireDecisionApproval !== false) {
    const lots = await tx.inspectionLot.findMany({
      where: { jobId: lot.jobId, companyId: input.companyId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        lotNumber: true,
        inspection: {
          select: {
            inspectionStatus: true,
            decisionStatus: true,
          },
        },
      },
    });
    const blockingLots = lots.filter(
      (entry) => !isInspectionReadyForSampling(entry.inspection),
    );

    if (lots.length === 0 || blockingLots.length > 0) {
      throw new Error(
        `ALL_LOTS_NOT_READY:${blockingLots.map((entry) => entry.lotNumber).join(", ") || "No lots available"}`,
      );
    }
  }

  return lot;
}

async function fetchSample(tx: PrismaLike, jobId: string) {
  return tx.sample.findFirst({
    where: { jobId },
    orderBy: { createdAt: "desc" },
    include: sampleInclude,
  });
}

async function syncSampleSealTraceabilityFromJobLots(
  tx: PrismaLike,
  input: {
    jobId: string;
    sampleId: string;
    companyId: string;
  },
) {
  const lotSeals = await tx.inspectionLot.findMany({
    where: {
      jobId: input.jobId,
      companyId: input.companyId,
    },
    select: {
      sealNumber: true,
      sample: {
        select: {
          sealLabel: {
            select: {
              sealNo: true,
            },
          },
        },
      },
    },
  });
  const sealNumber = lotSeals.map((lot) => lot.sample?.sealLabel?.sealNo ?? lot.sealNumber ?? null).find((value) => Boolean(value?.trim()));
  if (!sealNumber) {
    return false;
  }
  return syncSampleSealTraceability(tx, {
    sampleId: input.sampleId,
    sealNumber,
  });
}

async function getWorkflowPolicy(tx: PrismaLike, companyId: string) {
  const settings = await tx.moduleWorkflowSettings.upsert({
    where: { companyId },
    update: {},
    create: buildModuleWorkflowSettingsCreate(companyId),
  });
  return toModuleWorkflowPolicy(settings);
}

async function ensureSampleStarted(
  tx: Prisma.TransactionClient,
  input: {
    jobId?: string | null;
    lotId?: string | null;
    companyId: string;
    userId: string;
    sampleCode?: string | null;
  },
) {
  const lot = await getSamplingScope(tx, {
    jobId: input.jobId,
    lotId: input.lotId,
    companyId: input.companyId,
    requireDecisionApproval: true,
  });
  const workflowPolicy = await getWorkflowPolicy(tx, input.companyId);
  const existingSample = await fetchSample(tx, lot.jobId);
  if (existingSample) {
    await syncSampleSealTraceabilityFromJobLots(tx, {
      jobId: lot.jobId,
      sampleId: existingSample.id,
      companyId: input.companyId,
    });
    return (await fetchSample(tx, lot.jobId)) ?? existingSample;
  }

  const sampleCode = workflowPolicy.workflow.autoSampleIdGeneration
    ? buildSampleCode(lot.job.inspectionSerialNumber, "HOMO")
    : input.sampleCode?.trim() || null;
  if (!sampleCode) {
    throw new Error("SAMPLE_CODE_REQUIRED");
  }
  const created = await tx.sample.create({
    data: {
      companyId: input.companyId,
      jobId: lot.jobId,
      lotId: null,
      inspectionId: null,
      sampleCode,
      sampleStatus: "SAMPLING_IN_PROGRESS",
      samplingDate: new Date(),
      createdById: input.userId,
    },
    include: sampleInclude,
  });

  await createSampleEvent(tx, {
    sampleId: created.id,
    eventType: "SAMPLE_CREATED",
    performedById: input.userId,
    remarks: "Job-level homogeneous sample created from all passed lots.",
    metadata: {
      contributorMode: "ALL_JOB_LOTS",
    },
  });

  await createSampleEvent(tx, {
    sampleId: created.id,
    eventType: "SAMPLE_COLLECTED",
    performedById: input.userId,
    remarks: "Scoops from every lot must be mixed in one homogeneous bag.",
  });

  await syncSampleSealTraceabilityFromJobLots(tx, {
    jobId: lot.jobId,
    sampleId: created.id,
    companyId: input.companyId,
  });

  await recordAuditLog(tx, {
    jobId: lot.jobId,
    userId: input.userId,
    entity: "SAMPLE",
    action: "SAMPLE_CREATED",
    to: "SAMPLING_IN_PROGRESS",
    metadata: {
      sampleId: created.id,
      sampleCode: created.sampleCode,
      contributorMode: "ALL_JOB_LOTS",
    },
  });

  await recomputeJobWorkflowMilestones(tx, {
    jobId: lot.jobId,
    companyId: input.companyId,
  });

  return (await fetchSample(tx, lot.jobId)) ?? created;
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    const lotId = request.nextUrl.searchParams.get("lotId");
    const jobId = request.nextUrl.searchParams.get("jobId");
    const scope = await getSamplingScope(prisma, {
      lotId,
      jobId,
      companyId: currentUser.companyId,
      requireDecisionApproval: false,
    });
    const sample = await prisma.$transaction(async (tx) => {
      const existing = await fetchSample(tx, scope.jobId);
      if (!existing) {
        return existing;
      }
      await syncSampleSealTraceabilityFromJobLots(tx, {
        jobId: scope.jobId,
        sampleId: existing.id,
        companyId: currentUser.companyId,
      });
      return (await fetchSample(tx, scope.jobId)) ?? existing;
    });
    return NextResponse.json(sample);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load sample management record.";
    return jsonError("System Error", message, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    const body = await request.json();
    const lotId = typeof body?.lotId === "string" ? body.lotId.trim() : "";
    const jobId = typeof body?.jobId === "string" ? body.jobId.trim() : "";
    const caller = typeof body?.caller === "string" ? body.caller.trim() : "";
    const sampleCode = typeof body?.sampleCode === "string" ? body.sampleCode.trim() : "";
    if (!lotId && !jobId) {
      return jsonError("Validation Error", "jobId is required. lotId-only requests are deprecated compatibility input.", 400);
    }
    if (lotId && !jobId) {
      logLotIdCompatibilityUsage({
        route: "/api/inspection/sample-management",
        caller,
        hasJobId: false,
        hasLotId: true,
      });
    }

    const sample = await prisma.$transaction((tx) =>
      ensureSampleStarted(tx, {
        jobId,
        lotId,
        companyId: currentUser.companyId,
        userId: currentUser.id,
        sampleCode,
      }),
    );

    return NextResponse.json(sample);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to start sampling.";

    if (message === "FORBIDDEN") {
      return jsonError("Forbidden", "Cross-company access is not allowed.", 403);
    }

    if (message === "JOB_LOCKED") {
      return jsonError("Forbidden", "This job is LOCKED for audit integrity. No modifications allowed.", 403);
    }

    if (message === "JOB_NOT_APPROVED" || message.startsWith("ALL_LOTS_NOT_READY:")) {
      const lots = message.startsWith("ALL_LOTS_NOT_READY:") ? message.replace("ALL_LOTS_NOT_READY:", "") : "";
      return jsonError(
        "Validation Error",
        lots
          ? `All lots must pass inspection before creating the homogeneous sample. Blocking lots: ${lots}.`
          : "All lots must pass inspection before creating the homogeneous sample.",
        422,
      );
    }
    if (message === "JOB_ID_REQUIRED") {
      return jsonError("Validation Error", "jobId is required.", 400);
    }
    if (message === "SAMPLE_CODE_REQUIRED") {
      return jsonError("Validation Error", "Sample ID is required when auto sample ID generation is disabled.", 400);
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

    const body = await request.json();
    const lotId = typeof body?.lotId === "string" ? body.lotId.trim() : "";
    const jobId = typeof body?.jobId === "string" ? body.jobId.trim() : "";
    const caller = typeof body?.caller === "string" ? body.caller.trim() : "";
    if (!lotId && !jobId) {
      return jsonError("Validation Error", "jobId is required. lotId-only requests are deprecated compatibility input.", 400);
    }
    if (lotId && !jobId) {
      logLotIdCompatibilityUsage({
        route: "/api/inspection/sample-management",
        caller,
        hasJobId: false,
        hasLotId: true,
      });
    }

    const sample = await prisma.$transaction(async (tx) => {
      const workflowPolicy = await getWorkflowPolicy(tx, currentUser.companyId);
      const started = await ensureSampleStarted(tx, {
        jobId,
        lotId,
        companyId: currentUser.companyId,
        userId: currentUser.id,
        sampleCode: typeof body?.sampleCode === "string" ? body.sampleCode.trim() : "",
      });
      const previous = started as unknown as SampleRecord;

      const sampleCode = body?.sampleCode !== undefined ? normalizeText(body.sampleCode) : undefined;
      const sampleType = body?.sampleType !== undefined ? normalizeText(body.sampleType) : undefined;
      const samplingMethod = body?.samplingMethod !== undefined ? normalizeText(body.samplingMethod) : undefined;
      const sampleQuantity = body?.sampleQuantity !== undefined ? normalizeNumber(body.sampleQuantity) : undefined;
      const sampleUnit = body?.sampleUnit !== undefined ? normalizeText(body.sampleUnit) : undefined;
      const containerType = body?.containerType !== undefined ? normalizeText(body.containerType) : undefined;
      const remarks = body?.remarks !== undefined ? normalizeText(body.remarks) : undefined;
      const samplingDate = body?.samplingDate !== undefined ? normalizeDate(body.samplingDate) : undefined;
      const sealNo = body?.sealNo !== undefined ? normalizeText(body.sealNo) : undefined;
      const labelText = body?.labelText !== undefined ? normalizeText(body.labelText) : undefined;
      const markHomogenized = body?.markHomogenized === true;
      const markReadyForPacketing = body?.markReadyForPacketing === true;
      const markSealed = body?.markSealed === true;
      const markLabeled = body?.markLabeled === true;

      if (!workflowPolicy.workflow.autoSampleIdGeneration && sampleCode !== undefined && !sampleCode) {
        throw new Error("SAMPLE_CODE_REQUIRED");
      }

      if (sampleQuantity !== undefined && sampleQuantity !== null && sampleQuantity <= 0) {
        throw new Error("INVALID_SAMPLE_QUANTITY");
      }

      const updateData: Prisma.SampleUpdateInput = {
        ...(!workflowPolicy.workflow.autoSampleIdGeneration && typeof sampleCode === "string" ? { sampleCode } : {}),
        ...(sampleType !== undefined ? { sampleType } : {}),
        ...(samplingMethod !== undefined ? { samplingMethod } : {}),
        ...(sampleQuantity !== undefined ? { sampleQuantity } : {}),
        ...(sampleUnit !== undefined ? { sampleUnit } : {}),
        ...(containerType !== undefined ? { containerType } : {}),
        ...(remarks !== undefined ? { remarks } : {}),
        ...(samplingDate !== undefined ? { samplingDate } : {}),
      };

      if (markHomogenized && workflowPolicy.sampling.homogeneousProofRequired && !previous.homogenizedAt) {
        updateData.homogenizedAt = new Date();
        updateData.homogeneousProofDone = true;
      }

      if (Object.keys(updateData).length > 0) {
        await tx.sample.update({
          where: { id: previous.id },
          data: updateData,
        });
      }

      if (Array.isArray(body?.mediaEntries)) {
        for (const entry of body.mediaEntries as Array<Record<string, unknown>>) {
          const mediaType = normalizeSampleMediaType(entry?.mediaType);
          const fileUrl = normalizeText(entry?.fileUrl);
          const mediaRemarks = normalizeText(entry?.remarks);

          if (!mediaType || !fileUrl) {
            continue;
          }

          const existing = await tx.sampleMedia.findFirst({
            where: { sampleId: previous.id, mediaType },
            orderBy: { capturedAt: "desc" },
          });

          if (existing) {
            await tx.sampleMedia.update({
              where: { id: existing.id },
              data: {
                fileUrl,
                remarks: mediaRemarks,
                capturedAt: new Date(),
                capturedById: currentUser.id,
              },
            });
          } else {
            await tx.sampleMedia.create({
              data: {
                sampleId: previous.id,
                mediaType,
                fileUrl,
                remarks: mediaRemarks,
                capturedById: currentUser.id,
              },
            });
          }
        }
      }

      if (
        sealNo !== undefined ||
        labelText !== undefined ||
        markSealed ||
        markLabeled
      ) {
        if (
          (sealNo !== undefined || markSealed || markLabeled) &&
          previous.sealLabel?.sealNo &&
          !canEditSealWithRoles(currentUser.role, workflowPolicy.seal.sealEditPolicy, workflowPolicy.seal.sealEditRoles)
        ) {
          throw new Error("SEAL_EDIT_FORBIDDEN");
        }
        await tx.sampleSealLabel.upsert({
          where: { sampleId: previous.id },
          update: {
            ...(sealNo !== undefined ? { sealNo } : {}),
            ...(labelText !== undefined ? { labelText } : {}),
            ...(markSealed ? { sealedAt: previous.sealLabel?.sealedAt ?? new Date() } : {}),
            ...(markLabeled ? { labeledAt: previous.sealLabel?.labeledAt ?? new Date() } : {}),
            ...(markSealed || markLabeled ? { sealStatus: "COMPLETED" } : {}),
          },
          create: {
            sampleId: previous.id,
            sealNo: sealNo ?? null,
            labelText: labelText ?? null,
            sealedAt: markSealed ? new Date() : null,
            labeledAt: markLabeled ? new Date() : null,
            sealStatus: markSealed || markLabeled ? "COMPLETED" : "PENDING",
          },
        });
      }

      const jobLotSeals = await tx.inspectionLot.findMany({
        where: { jobId: started.jobId, companyId: currentUser.companyId },
        select: {
          sealNumber: true,
          sample: {
            select: {
              sealLabel: {
                select: {
                  sealNo: true,
                },
              },
            },
          },
        },
      });
      const lotSealNumbers = jobLotSeals.map((lot) => lot.sample?.sealLabel?.sealNo ?? lot.sealNumber ?? null);
      const refreshed = (await fetchSample(tx, started.jobId)) as unknown as SampleRecord | null;
      if (!refreshed) {
        throw new Error("SAMPLE_NOT_FOUND");
      }

      const detailsNow = hasSampleDetails(refreshed);
      const detailsBefore = hasSampleDetails(previous);
      const homogenizedNow = hasHomogenizedSample(refreshed);
      const homogenizedBefore = hasHomogenizedSample(previous);
      const sealedNow = hasSealAndLabel(refreshed, { lotSealNumbers });
      const sealedBefore = hasSealAndLabel(previous, { lotSealNumbers });
      const readinessBefore = getSampleReadiness(previous, { lotSealNumbers }).isReady;
      const readinessNow = getSampleReadiness(refreshed, { lotSealNumbers });

      let nextStatus = deriveSampleStatusWithContext(refreshed, { lotSealNumbers });
      let readyAt = refreshed.readyForPacketingAt ? new Date(refreshed.readyForPacketingAt) : null;

      if (markReadyForPacketing) {
        if (!readinessNow.isReady) {
          throw new Error(`READINESS_BLOCKED:${readinessNow.blockers.map((blocker) => blocker.detail).join(" | ")}`);
        }
        nextStatus = "READY_FOR_PACKETING";
        readyAt = readyAt ?? new Date();
      }

      const finalized = (await tx.sample.update({
        where: { id: refreshed.id },
        data: {
          sampleStatus: nextStatus,
          readyForPacketingAt: nextStatus === "READY_FOR_PACKETING" ? readyAt : null,
          samplingDate: refreshed.samplingDate ?? new Date(),
        },
        include: sampleInclude,
      })) as unknown as SampleRecord;

      if (!detailsBefore && detailsNow) {
        await createSampleEvent(tx, {
          sampleId: finalized.id,
          eventType: "DETAILS_CAPTURED",
          performedById: currentUser.id,
        });
      }

      if (!homogenizedBefore && homogenizedNow) {
        await createSampleEvent(tx, {
          sampleId: finalized.id,
          eventType: "HOMOGENIZED",
          performedById: currentUser.id,
        });
      }

      if (!previous.media?.length && (finalized.media?.length ?? 0) > 0) {
        await createSampleEvent(tx, {
          sampleId: finalized.id,
          eventType: "SAMPLE_COLLECTED",
          performedById: currentUser.id,
          remarks: "Sampling proof captured.",
        });
      }

      if (!previous.sealLabel?.labeledAt && finalized.sealLabel?.labeledAt) {
        await createSampleEvent(tx, {
          sampleId: finalized.id,
          eventType: "LABELED",
          performedById: currentUser.id,
        });
      }

      if (!sealedBefore && sealedNow) {
        await createSampleEvent(tx, {
          sampleId: finalized.id,
          eventType: "SEALED",
          performedById: currentUser.id,
        });
      }

      if (!readinessBefore && nextStatus === "READY_FOR_PACKETING") {
        await createSampleEvent(tx, {
          sampleId: finalized.id,
          eventType: "READY_FOR_PACKETING",
          performedById: currentUser.id,
        });
      }

      await recordAuditLog(tx, {
        jobId: finalized.jobId,
        userId: currentUser.id,
        entity: "SAMPLE",
        action: nextStatus === "READY_FOR_PACKETING" ? "SAMPLE_READY" : "SAMPLE_UPDATED",
        to: nextStatus,
        metadata: {
          sampleId: finalized.id,
          lotId: finalized.lotId,
          readinessMissing: readinessNow.missing,
        },
      });

      await recomputeJobWorkflowMilestones(tx, {
        jobId: finalized.jobId,
        companyId: currentUser.companyId,
      });

      return (await fetchSample(tx, finalized.jobId)) ?? finalized;
    });

    return NextResponse.json(sample);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update sample management record.";

    if (message === "FORBIDDEN") {
      return jsonError("Forbidden", "Cross-company access is not allowed.", 403);
    }

    if (message === "JOB_LOCKED") {
      return jsonError("Forbidden", "This job is LOCKED for audit integrity. No modifications allowed.", 403);
    }

    if (message === "JOB_NOT_APPROVED" || message.startsWith("ALL_LOTS_NOT_READY:")) {
      const lots = message.startsWith("ALL_LOTS_NOT_READY:") ? message.replace("ALL_LOTS_NOT_READY:", "") : "";
      return jsonError(
        "Validation Error",
        lots
          ? `All lots must pass inspection before creating the homogeneous sample. Blocking lots: ${lots}.`
          : "All lots must pass inspection before creating the homogeneous sample.",
        422,
      );
    }
    if (message === "JOB_ID_REQUIRED") {
      return jsonError("Validation Error", "jobId is required.", 400);
    }

    if (message === "INVALID_SAMPLE_QUANTITY") {
      return jsonError("Validation Error", "Sample quantity must be a positive number.", 400);
    }
    if (message === "SAMPLE_CODE_REQUIRED") {
      return jsonError("Validation Error", "Sample ID is required when auto sample ID generation is disabled.", 400);
    }
    if (message === "SEAL_EDIT_FORBIDDEN") {
      return jsonError("Forbidden", "Only Admin can edit seal values after seal mapping is created.", 403);
    }

    if (message.startsWith("READINESS_BLOCKED:")) {
      const details = message.replace("READINESS_BLOCKED:", "").split("|").map((value) => value.trim()).filter(Boolean).join(", ");
      return jsonError("Validation Error", details || "Sample is not ready for packet generation.", 422);
    }
    return jsonError("System Error", message, 500);
  }
}
