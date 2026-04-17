import { Prisma, PrismaClient, RndJobStatus } from "@prisma/client";

type RndReportGenerationDb = Pick<PrismaClient, "inspectionJob" | "rndJob" | "reportSnapshot" | "rndReportVersion">;

export class ReportGenerationError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ReportGenerationError";
    this.status = status;
  }
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === "object" && value !== null && "toNumber" in value && typeof (value as { toNumber: unknown }).toNumber === "function") {
    try {
      const parsed = (value as { toNumber: () => number }).toNumber();
      return Number.isFinite(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

type ReportGenerationInput = {
  companyId: string;
  jobId?: string;
  rndJobId?: string;
};

type ReportGenerationLineage = {
  parentJobId: string;
  sampleId: string;
} | null;

type ReportGenerationJob = {
  id: string;
  companyId: string;
  jobReferenceNumber: string | null;
  inspectionSerialNumber: string | null;
  clientName: string | null;
  commodity: string | null;
  plantLocation: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  lots: Array<{
    id: string;
    lotNumber: string | null;
    quantityMode: string | null;
    totalBags: number | null;
    grossWeight: Prisma.Decimal | number | string | null;
    tareWeight: Prisma.Decimal | number | string | null;
    netWeight: Prisma.Decimal | number | string | null;
    grossWeightKg: Prisma.Decimal | number | string | null;
    netWeightKg: Prisma.Decimal | number | string | null;
    sealNumber: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    bags: Array<{
      id: string;
      bagNumber: number;
      grossWeight: Prisma.Decimal | number | string | null;
      netWeight: Prisma.Decimal | number | string | null;
    }>;
    sample: null | {
      id: string;
      sampleCode: string | null;
      sampleStatus: string;
      sampleType: string | null;
      samplingMethod: string | null;
      samplingDate: Date | null;
      sampleQuantity: Prisma.Decimal | number | string | null;
      sampleUnit: string | null;
      containerType: string | null;
      homogenizedAt: Date | null;
      readyForPacketingAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      sealLabel: { sealNo: string | null } | null;
      media: Array<Record<string, unknown>>;
      events: Array<Record<string, unknown>>;
      packets: Array<{
        id: string;
        packetCode: string | null;
        packetNo: number | null;
        packetStatus: string;
        packetQuantity: Prisma.Decimal | number | string | null;
        packetWeight?: Prisma.Decimal | number | string | null;
        packetUnit: string | null;
        packetType: string | null;
        readyAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        sealLabel: { sealNo: string | null } | null;
        media: Array<Record<string, unknown>>;
        allocation: Array<Record<string, unknown>>;
      }>;
    };
  }>;
  samples: Array<{
    id: string;
    sampleCode: string | null;
    sampleStatus: string;
    sampleType: string | null;
    samplingMethod: string | null;
    samplingDate: Date | null;
    sampleQuantity: Prisma.Decimal | number | string | null;
    sampleUnit: string | null;
    containerType: string | null;
    homogenizedAt: Date | null;
    readyForPacketingAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    sealLabel: { sealNo: string | null } | null;
    media: Array<Record<string, unknown>>;
    events: Array<Record<string, unknown>>;
    packets: Array<{
      id: string;
      packetCode: string | null;
      packetNo: number | null;
      packetStatus: string;
      packetQuantity: Prisma.Decimal | number | string | null;
      packetWeight: Prisma.Decimal | number | string | null;
      packetUnit: string | null;
      packetType: string | null;
      readyAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      sealLabel: { sealNo: string | null } | null;
      media: Array<Record<string, unknown>>;
      allocation: Array<Record<string, unknown>>;
    }>;
  }>;
  rndJobs: Array<{
    id: string;
    rndJobNumber: string;
    status: RndJobStatus;
    resultPrecedence: string;
    sampleId: string;
    packetId: string | null;
    reviewedAt: Date | null;
    completedAt: Date | null;
    readings: Array<{
      id: string;
      parameter: string;
      value: Prisma.Decimal | number | string | null;
      unit: string | null;
      remarks: string | null;
      createdAt: Date;
    }>;
  }>;
  experiments: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: Date;
    trials: Array<{
      id: string;
      lotId: string | null;
      packetId: string | null;
      trialNumber: number;
      notes: string | null;
      grossWeightKg: Prisma.Decimal | number | string | null;
      netWeightKg: Prisma.Decimal | number | string | null;
      createdAt: Date;
      measurements: Array<{
        id: string;
        element: string;
        value: Prisma.Decimal | number | string | null;
        createdAt: Date;
      }>;
    }>;
  }>;
};

type ReportGenerationScope = {
  jobId: string;
  lineage: ReportGenerationLineage;
};

function buildSnapshotData(job: ReportGenerationJob, nowIso: string): Prisma.InputJsonValue {
  const packetCount = job.samples.reduce((sum, sample) => sum + sample.packets.length, 0);
  const legacyTrialCount = job.experiments.reduce((sum, experiment) => sum + experiment.trials.length, 0);
  const trialCount = Math.max(legacyTrialCount, job.rndJobs.length);

  return JSON.parse(
    JSON.stringify({
      schemaVersion: "report_snapshot_v2",
      generatedAt: nowIso,
      summary: {
        lotCount: job.lots.length,
        sampleCount: job.samples.length,
        packetCount,
        trialCount,
      },
      job: {
        id: job.id,
        companyId: job.companyId,
        jobReferenceNumber: job.jobReferenceNumber,
        inspectionSerialNumber: job.inspectionSerialNumber,
        clientName: job.clientName,
        commodity: job.commodity,
        plantLocation: job.plantLocation,
        status: job.status,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      },
      lots: job.lots.map((lot) => ({
        id: lot.id,
        lotNumber: lot.lotNumber,
        quantityMode: lot.quantityMode,
        totalBags: lot.totalBags,
        grossWeight: toNumber(lot.grossWeight),
        tareWeight: toNumber(lot.tareWeight),
        netWeight: toNumber(lot.netWeight),
        grossWeightKg: toNumber(lot.grossWeightKg),
        netWeightKg: toNumber(lot.netWeightKg),
        sealNumber: lot.sealNumber,
        status: lot.status,
        createdAt: lot.createdAt,
        updatedAt: lot.updatedAt,
        bags: lot.bags.map((bag) => ({
          id: bag.id,
          bagNumber: bag.bagNumber,
          grossWeight: toNumber(bag.grossWeight),
          netWeight: toNumber(bag.netWeight),
        })),
        sample: lot.sample
          ? {
              id: lot.sample.id,
              sampleCode: lot.sample.sampleCode,
              sampleStatus: lot.sample.sampleStatus,
              sampleType: lot.sample.sampleType,
              samplingMethod: lot.sample.samplingMethod,
              samplingDate: lot.sample.samplingDate,
              sampleQuantity: toNumber(lot.sample.sampleQuantity),
              sampleUnit: lot.sample.sampleUnit,
              containerType: lot.sample.containerType,
              homogenizedAt: lot.sample.homogenizedAt,
              readyForPacketingAt: lot.sample.readyForPacketingAt,
              createdAt: lot.sample.createdAt,
              updatedAt: lot.sample.updatedAt,
              sealLabel: lot.sample.sealLabel,
              media: lot.sample.media,
              events: lot.sample.events,
              packets: lot.sample.packets.map((packet) => ({
                id: packet.id,
                packetCode: packet.packetCode,
                packetNo: packet.packetNo,
                packetStatus: packet.packetStatus,
                packetQuantity: toNumber(packet.packetQuantity),
                packetUnit: packet.packetUnit,
                packetType: packet.packetType,
                readyAt: packet.readyAt,
                createdAt: packet.createdAt,
                updatedAt: packet.updatedAt,
                sealLabel: packet.sealLabel,
                media: packet.media,
                allocation: packet.allocation,
              })),
            }
          : null,
      })),
      samples: job.samples.map((sample) => ({
        id: sample.id,
        sampleCode: sample.sampleCode,
        sampleStatus: sample.sampleStatus,
        sampleType: sample.sampleType,
        samplingMethod: sample.samplingMethod,
        samplingDate: sample.samplingDate,
        sampleQuantity: toNumber(sample.sampleQuantity),
        sampleUnit: sample.sampleUnit,
        containerType: sample.containerType,
        homogenizedAt: sample.homogenizedAt,
        readyForPacketingAt: sample.readyForPacketingAt,
        createdAt: sample.createdAt,
        updatedAt: sample.updatedAt,
        sealLabel: sample.sealLabel,
        media: sample.media,
        events: sample.events,
        packets: sample.packets.map((packet) => ({
          id: packet.id,
          packetCode: packet.packetCode,
          packetNo: packet.packetNo,
          packetStatus: packet.packetStatus,
          packetQuantity: toNumber(packet.packetQuantity),
          packetWeight: toNumber(packet.packetWeight),
          packetUnit: packet.packetUnit,
          packetType: packet.packetType,
          readyAt: packet.readyAt,
          createdAt: packet.createdAt,
          updatedAt: packet.updatedAt,
          sealLabel: packet.sealLabel,
          media: packet.media,
          allocation: packet.allocation,
        })),
      })),
      rndJobs: job.rndJobs.map((rndJob) => ({
        id: rndJob.id,
        rndJobNumber: rndJob.rndJobNumber,
        status: rndJob.status,
        resultPrecedence: rndJob.resultPrecedence,
        sampleId: rndJob.sampleId,
        packetId: rndJob.packetId,
        reviewedAt: rndJob.reviewedAt,
        completedAt: rndJob.completedAt,
        readings: rndJob.readings.map((reading) => ({
          id: reading.id,
          parameter: reading.parameter,
          value: toNumber(reading.value),
          unit: reading.unit,
          remarks: reading.remarks,
          createdAt: reading.createdAt,
        })),
      })),
      experiments: job.experiments.map((experiment) => ({
        id: experiment.id,
        title: experiment.title,
        status: experiment.status,
        createdAt: experiment.createdAt,
        trials: experiment.trials.map((trial) => ({
          id: trial.id,
          lotId: trial.lotId,
          packetId: trial.packetId,
          trialNumber: trial.trialNumber,
          notes: trial.notes,
          grossWeightKg: toNumber(trial.grossWeightKg),
          netWeightKg: toNumber(trial.netWeightKg),
          createdAt: trial.createdAt,
          measurements: trial.measurements.map((measurement) => ({
            id: measurement.id,
            element: measurement.element,
            value: toNumber(measurement.value),
            createdAt: measurement.createdAt,
          })),
        })),
      })),
    })
  ) as Prisma.InputJsonValue;
}

async function resolveScope(
  db: RndReportGenerationDb,
  input: ReportGenerationInput,
): Promise<ReportGenerationScope> {
  const { companyId, jobId: initialJobId = "", rndJobId: initialRndJobId = "" } = input;
  let jobId = initialJobId;
  let lineage: ReportGenerationLineage = null;

  if (initialRndJobId) {
    const scopedRndJob = await db.rndJob.findUnique({
      where: { id: initialRndJobId },
      select: {
        id: true,
        companyId: true,
        parentJobId: true,
        sampleId: true,
        status: true,
      },
    });

    if (!scopedRndJob) {
      throw new ReportGenerationError(404, "R&D job not found.");
    }
    if (scopedRndJob.companyId !== companyId) {
      throw new ReportGenerationError(403, "Cross-company access is not allowed.");
    }
    if (scopedRndJob.status !== RndJobStatus.APPROVED && scopedRndJob.status !== RndJobStatus.COMPLETED) {
      throw new ReportGenerationError(422, "Reports can be linked only for approved/completed R&D jobs.");
    }
    if (jobId && jobId !== scopedRndJob.parentJobId) {
      throw new ReportGenerationError(422, "jobId does not match rndJob lineage.");
    }

    jobId = scopedRndJob.parentJobId;
    lineage = {
      parentJobId: scopedRndJob.parentJobId,
      sampleId: scopedRndJob.sampleId,
    };
  }

  if (!jobId) {
    throw new ReportGenerationError(400, "jobId or rndJobId is required.");
  }

  return { jobId, lineage };
}

export async function generateAndLinkRndReportSnapshot(
  db: RndReportGenerationDb,
  input: ReportGenerationInput,
) {
  const scope = await resolveScope(db, input);

  const job = (await db.inspectionJob.findUnique({
    where: { id: scope.jobId },
    select: {
      id: true,
      companyId: true,
      jobReferenceNumber: true,
      inspectionSerialNumber: true,
      clientName: true,
      commodity: true,
      plantLocation: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      lots: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          lotNumber: true,
          quantityMode: true,
          totalBags: true,
          grossWeight: true,
          tareWeight: true,
          netWeight: true,
          grossWeightKg: true,
          netWeightKg: true,
          sealNumber: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          bags: {
            orderBy: { bagNumber: "asc" },
            select: {
              id: true,
              bagNumber: true,
              grossWeight: true,
              netWeight: true,
            },
          },
          sample: {
            select: {
              id: true,
              sampleCode: true,
              sampleStatus: true,
              sampleType: true,
              samplingMethod: true,
              samplingDate: true,
              sampleQuantity: true,
              sampleUnit: true,
              containerType: true,
              homogenizedAt: true,
              readyForPacketingAt: true,
              createdAt: true,
              updatedAt: true,
              sealLabel: true,
              media: true,
              events: true,
              packets: {
                orderBy: { packetNo: "asc" },
                select: {
                  id: true,
                  packetCode: true,
                  packetNo: true,
                  packetStatus: true,
                  packetQuantity: true,
                  packetUnit: true,
                  packetType: true,
                  readyAt: true,
                  createdAt: true,
                  updatedAt: true,
                  sealLabel: true,
                  media: true,
                  allocation: true,
                },
              },
            },
          },
        },
      },
      samples: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          sampleCode: true,
          sampleStatus: true,
          sampleType: true,
          samplingMethod: true,
          samplingDate: true,
          sampleQuantity: true,
          sampleUnit: true,
          containerType: true,
          homogenizedAt: true,
          readyForPacketingAt: true,
          createdAt: true,
          updatedAt: true,
          sealLabel: true,
          media: true,
          events: true,
          packets: {
            orderBy: { packetNo: "asc" },
            select: {
              id: true,
              packetCode: true,
              packetNo: true,
              packetStatus: true,
              packetQuantity: true,
              packetWeight: true,
              packetUnit: true,
              packetType: true,
              readyAt: true,
              createdAt: true,
              updatedAt: true,
              sealLabel: true,
              media: true,
              allocation: true,
            },
          },
        },
      },
      rndJobs: {
        where: {
          resultPrecedence: "ACTIVE",
          status: { in: ["APPROVED", "COMPLETED"] },
        },
        orderBy: { reviewedAt: "desc" },
        select: {
          id: true,
          rndJobNumber: true,
          status: true,
          resultPrecedence: true,
          packetId: true,
          sampleId: true,
          reviewedAt: true,
          completedAt: true,
          readings: true,
        },
      },
      experiments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          trials: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              lotId: true,
              packetId: true,
              trialNumber: true,
              notes: true,
              grossWeightKg: true,
              netWeightKg: true,
              createdAt: true,
              measurements: true,
            },
          },
        },
      },
    },
  })) as ReportGenerationJob | null;

  if (!job) {
    throw new ReportGenerationError(404, "Job not found.");
  }
  if (job.companyId !== input.companyId) {
    throw new ReportGenerationError(403, "Cross-company access is not allowed.");
  }

  const snapshotData = buildSnapshotData(job, new Date().toISOString());

  const snapshot = await db.reportSnapshot.create({
    data: {
      jobId: scope.jobId,
      data: snapshotData,
    },
  });

  if (scope.lineage) {
    await db.rndReportVersion.updateMany({
      where: {
        companyId: input.companyId,
        parentJobId: scope.lineage.parentJobId,
        sampleId: scope.lineage.sampleId,
        precedence: "ACTIVE",
      },
      data: { precedence: "SUPERSEDED" },
    });

    await db.rndReportVersion.create({
      data: {
        companyId: input.companyId,
        parentJobId: scope.lineage.parentJobId,
        sampleId: scope.lineage.sampleId,
        rndJobId: input.rndJobId!,
        reportSnapshotId: snapshot.id,
        precedence: "ACTIVE",
      },
    });
  }

  return snapshot;
}
