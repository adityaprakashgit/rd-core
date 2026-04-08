import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit";
import {
  buildSampleCode,
  deriveSampleStatus,
  getSampleReadiness,
  hasHomogenizedSample,
  hasSampleDetails,
  hasSealAndLabel,
  mapSampleMediaByType,
  normalizeSampleMediaType,
} from "@/lib/sample-management";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
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

async function getLotScope(tx: PrismaLike, lotId: string, companyId: string) {
  const lot = await tx.inspectionLot.findUnique({
    where: { id: lotId },
    select: {
      id: true,
      jobId: true,
      companyId: true,
      lotNumber: true,
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
        },
      },
      inspection: {
        select: {
          id: true,
          inspectionStatus: true,
          decisionStatus: true,
        },
      },
    },
  });

  if (!lot || lot.companyId !== companyId) {
    throw new Error("FORBIDDEN");
  }

  if (!lot.inspection) {
    throw new Error("INSPECTION_REQUIRED");
  }

  if (lot.job.status === "LOCKED") {
    throw new Error("JOB_LOCKED");
  }

  if (
    lot.inspection &&
    (lot.inspection.inspectionStatus !== "COMPLETED" || lot.inspection.decisionStatus !== "READY_FOR_SAMPLING")
  ) {
    throw new Error("LOT_NOT_APPROVED");
  }

  return lot;
}

async function syncLegacySampling(
  tx: Prisma.TransactionClient,
  sample: SampleRecord,
  options?: {
    sealAuto?: boolean;
  },
) {
  const mediaMap = mapSampleMediaByType(sample.media);
  const containerPhotoUrl = mediaMap.SAMPLE_CONTAINER?.fileUrl ?? mediaMap.SAMPLE_CONDITION?.fileUrl ?? null;
  const beforePhotoUrl =
    mediaMap.SAMPLE_CONDITION?.fileUrl ??
    mediaMap.SAMPLING_IN_PROGRESS?.fileUrl ??
    mediaMap.SAMPLE_CONTAINER?.fileUrl ??
    null;
  const duringPhotoUrl = mediaMap.SAMPLING_IN_PROGRESS?.fileUrl ?? null;
  const afterPhotoUrl = mediaMap.SEALED_SAMPLE?.fileUrl ?? mediaMap.SAMPLE_CONTAINER?.fileUrl ?? null;

  await tx.sampling.upsert({
    where: { lotId: sample.lotId },
    update: {
      beforePhotoUrl,
      duringPhotoUrl,
      afterPhotoUrl,
      status: sample.sampleStatus,
    },
    create: {
      lotId: sample.lotId,
      companyId: sample.companyId,
      beforePhotoUrl,
      duringPhotoUrl,
      afterPhotoUrl,
      status: sample.sampleStatus,
    },
  });

  await tx.inspectionLot.update({
    where: { id: sample.lotId },
    data: {
      status: sample.sampleStatus === "READY_FOR_PACKETING" ? "SAMPLED" : "SAMPLING_IN_PROGRESS",
      bagPhotoUrl: containerPhotoUrl ?? undefined,
      samplingPhotoUrl: duringPhotoUrl ?? afterPhotoUrl ?? beforePhotoUrl,
      sealPhotoUrl: mediaMap.SEALED_SAMPLE?.fileUrl ?? undefined,
      ...(sample.sealLabel?.sealNo ? { sealNumber: sample.sealLabel.sealNo } : {}),
      ...(typeof options?.sealAuto === "boolean" ? { sealAuto: options.sealAuto } : {}),
    },
  });
}

async function fetchSample(tx: PrismaLike, lotId: string) {
  return tx.sample.findUnique({
    where: { lotId },
    include: sampleInclude,
  });
}

async function ensureSampleStarted(
  tx: Prisma.TransactionClient,
  input: {
    lotId: string;
    companyId: string;
    userId: string;
  },
) {
  const lot = await getLotScope(tx, input.lotId, input.companyId);
  const existingSample = await fetchSample(tx, input.lotId);
  if (existingSample) {
    return existingSample;
  }

  let inspectionId = lot.inspection?.id;
  if (!inspectionId) {
    const autoInspection = await tx.inspection.create({
      data: {
        jobId: lot.jobId,
        lotId: lot.id,
        inspectorId: input.userId,
        inspectionStatus: "COMPLETED",
        decisionStatus: "READY_FOR_SAMPLING",
        samplingBlockedFlag: false,
        completedAt: new Date(),
        overallRemark: "Auto-created from sample management flow.",
      },
      select: { id: true },
    });
    inspectionId = autoInspection.id;

    await recordAuditLog(tx, {
      jobId: lot.jobId,
      userId: input.userId,
      entity: "INSPECTION",
      action: "INSPECTION_AUTO_CREATED",
      to: "READY_FOR_SAMPLING",
      metadata: {
        lotId: lot.id,
        inspectionId,
      },
    });
  }

  const sampleCode = buildSampleCode(lot.job.inspectionSerialNumber, lot.lotNumber);
  const created = await tx.sample.create({
    data: {
      companyId: input.companyId,
      jobId: lot.jobId,
      lotId: lot.id,
      inspectionId,
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
  });

  await createSampleEvent(tx, {
    sampleId: created.id,
    eventType: "SAMPLE_COLLECTED",
    performedById: input.userId,
    remarks: "Sampling started.",
  });

  await recordAuditLog(tx, {
    jobId: lot.jobId,
    userId: input.userId,
    entity: "SAMPLE",
    action: "SAMPLE_CREATED",
    to: "SAMPLING_IN_PROGRESS",
    metadata: {
      sampleId: created.id,
      lotId: lot.id,
      sampleCode: created.sampleCode,
    },
  });

  await syncLegacySampling(tx, created as unknown as SampleRecord);

  return (await fetchSample(tx, input.lotId)) ?? created;
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

    const lot = await prisma.inspectionLot.findUnique({
      where: { id: lotId },
      select: { companyId: true },
    });

    if (!lot || lot.companyId !== currentUser.companyId) {
      return jsonError("Forbidden", "Cross-company access is not allowed.", 403);
    }

    const sample = await fetchSample(prisma, lotId);
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
    if (!lotId) {
      return jsonError("Validation Error", "lotId is required.", 400);
    }

    const sample = await prisma.$transaction((tx) =>
      ensureSampleStarted(tx, {
        lotId,
        companyId: currentUser.companyId,
        userId: currentUser.id,
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

    if (message === "LOT_NOT_APPROVED") {
      return jsonError("Validation Error", "Lot inspection must be completed and approved for sampling first.", 422);
    }

    if (message === "INSPECTION_REQUIRED") {
      return jsonError("Validation Error", "Inspection record is required before sampling can begin.", 422);
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
    if (!lotId) {
      return jsonError("Validation Error", "lotId is required.", 400);
    }

    const sample = await prisma.$transaction(async (tx) => {
      const started = await ensureSampleStarted(tx, {
        lotId,
        companyId: currentUser.companyId,
        userId: currentUser.id,
      });
      const previous = started as unknown as SampleRecord;

      const sampleType = body?.sampleType !== undefined ? normalizeText(body.sampleType) : undefined;
      const samplingMethod = body?.samplingMethod !== undefined ? normalizeText(body.samplingMethod) : undefined;
      const sampleQuantity = body?.sampleQuantity !== undefined ? normalizeNumber(body.sampleQuantity) : undefined;
      const sampleUnit = body?.sampleUnit !== undefined ? normalizeText(body.sampleUnit) : undefined;
      const containerType = body?.containerType !== undefined ? normalizeText(body.containerType) : undefined;
      const remarks = body?.remarks !== undefined ? normalizeText(body.remarks) : undefined;
      const samplingDate = body?.samplingDate !== undefined ? normalizeDate(body.samplingDate) : undefined;
      const sealNo = body?.sealNo !== undefined ? normalizeText(body.sealNo) : undefined;
      const labelText = body?.labelText !== undefined ? normalizeText(body.labelText) : undefined;
      const sealAuto = body?.sealAuto === true;
      const markHomogenized = body?.markHomogenized === true;
      const markReadyForPacketing = body?.markReadyForPacketing === true;
      const markSealed = body?.markSealed === true;
      const markLabeled = body?.markLabeled === true;

      if (sampleQuantity !== undefined && sampleQuantity !== null && sampleQuantity <= 0) {
        throw new Error("INVALID_SAMPLE_QUANTITY");
      }

      const updateData: Prisma.SampleUpdateInput = {
        ...(sampleType !== undefined ? { sampleType } : {}),
        ...(samplingMethod !== undefined ? { samplingMethod } : {}),
        ...(sampleQuantity !== undefined ? { sampleQuantity } : {}),
        ...(sampleUnit !== undefined ? { sampleUnit } : {}),
        ...(containerType !== undefined ? { containerType } : {}),
        ...(remarks !== undefined ? { remarks } : {}),
        ...(samplingDate !== undefined ? { samplingDate } : {}),
      };

      if (markHomogenized && !previous.homogenizedAt) {
        updateData.homogenizedAt = new Date();
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

      const refreshed = (await fetchSample(tx, lotId)) as unknown as SampleRecord | null;
      if (!refreshed) {
        throw new Error("SAMPLE_NOT_FOUND");
      }

      const detailsNow = hasSampleDetails(refreshed);
      const detailsBefore = hasSampleDetails(previous);
      const homogenizedNow = hasHomogenizedSample(refreshed);
      const homogenizedBefore = hasHomogenizedSample(previous);
      const sealedNow = hasSealAndLabel(refreshed);
      const sealedBefore = hasSealAndLabel(previous);
      const readinessBefore = getSampleReadiness(previous).isReady;
      const readinessNow = getSampleReadiness(refreshed);

      let nextStatus = deriveSampleStatus(refreshed);
      let readyAt = refreshed.readyForPacketingAt ? new Date(refreshed.readyForPacketingAt) : null;

      if (markReadyForPacketing) {
        if (!readinessNow.isReady) {
          throw new Error(`READINESS_BLOCKED:${readinessNow.missing.join(" | ")}`);
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

      await syncLegacySampling(tx, finalized, {
        sealAuto: sealNo !== undefined || markSealed || markLabeled ? sealAuto : undefined,
      });

      return (await fetchSample(tx, lotId)) ?? finalized;
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

    if (message === "LOT_NOT_APPROVED") {
      return jsonError("Validation Error", "Lot inspection must be completed and approved for sampling first.", 422);
    }

    if (message === "INSPECTION_REQUIRED") {
      return jsonError("Validation Error", "Inspection record is required before sampling can begin.", 422);
    }

    if (message === "INVALID_SAMPLE_QUANTITY") {
      return jsonError("Validation Error", "Sample quantity must be a positive number.", 400);
    }

    if (message.startsWith("READINESS_BLOCKED:")) {
      const details = message.replace("READINESS_BLOCKED:", "").split("|").map((value) => value.trim()).filter(Boolean).join(", ");
      return jsonError("Validation Error", details || "Sample is not ready for packet generation.", 422);
    }
    return jsonError("System Error", message, 500);
  }
}
