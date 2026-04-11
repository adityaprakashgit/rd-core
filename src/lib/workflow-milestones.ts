import { Prisma } from "@prisma/client";

import { normalizeEvidenceCategoryKey } from "@/lib/evidence-definition";
import { resolveRequiredImageUploadCategories } from "@/lib/image-proof-policy";
import { buildModuleWorkflowSettingsCreate, toModuleWorkflowPolicy } from "@/lib/module-workflow-policy";

type PrismaLike = Prisma.TransactionClient;

export type AdminDecisionOutcome = "PASS" | "HOLD" | "REJECT";

type WorkflowMilestoneLot = {
  id: string;
  createdAt: string | Date;
  lotNumber: string;
  sealNumber: string | null;
  mediaFiles?: Array<{ category: string }>;
  inspection?: {
    sentToAdminAt?: string | Date | null;
    sentToAdminBy?: string | null;
    decisionAt?: string | Date | null;
    decisionBy?: string | null;
    decisionOutcome?: string | null;
    decisionStatus?: string | null;
  } | null;
  sample?: {
    id?: string;
    homogeneousProofDone?: boolean;
    homogenizedAt?: string | Date | null;
    sealLabel?: { sealNo?: string | null } | null;
    packets?: Array<{
      id: string;
      packetWeight?: number | null;
      packetUnit?: string | null;
      submittedToRndAt?: string | Date | null;
      submittedToRndBy?: string | null;
    }>;
  } | null;
};

type WorkflowMilestoneJob = {
  id: string;
  companyId: string;
  createdAt: string | Date;
  jobStartedAt?: string | Date | null;
  sentToAdminAt?: string | Date | null;
  sentToAdminBy?: string | null;
  adminDecisionAt?: string | Date | null;
  adminDecisionBy?: string | null;
  adminDecisionStatus?: string | null;
  operationsCompletedAt?: string | Date | null;
  handedOverToRndAt?: string | Date | null;
  handedOverToRndBy?: string | null;
  handedOverToRndTo?: string | null;
  lots?: WorkflowMilestoneLot[];
};

function toDate(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function latestDate(values: Array<string | Date | null | undefined>) {
  return values
    .map(toDate)
    .filter((value): value is Date => Boolean(value))
    .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
}

function mapDecisionOutcome(decisionStatus: string | null | undefined): AdminDecisionOutcome | null {
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

function getDecisionRollup(outcomes: AdminDecisionOutcome[]): AdminDecisionOutcome | null {
  if (outcomes.length === 0) {
    return null;
  }
  if (outcomes.includes("REJECT")) {
    return "REJECT";
  }
  if (outcomes.includes("HOLD")) {
    return "HOLD";
  }
  return "PASS";
}

export function computeJobWorkflowMilestoneUpdate(
  job: WorkflowMilestoneJob,
  settings: ReturnType<typeof toModuleWorkflowPolicy>,
  options?: { handedOverToRndTo?: string | null },
): Prisma.InspectionJobUpdateInput {
  const lots = job.lots ?? [];
  const firstLotCreatedAt = lots[0]?.createdAt ?? null;

  const allLotsSubmitted = lots.length > 0 && lots.every((lot) => Boolean(lot.inspection?.sentToAdminAt));
  const latestSubmittedLot =
    allLotsSubmitted
      ? [...lots]
          .filter((lot) => lot.inspection?.sentToAdminAt)
          .sort(
            (left, right) =>
              Number(new Date(right.inspection?.sentToAdminAt ?? 0)) -
              Number(new Date(left.inspection?.sentToAdminAt ?? 0)),
          )[0] ?? null
      : null;

  const lotOutcomes = lots.map((lot) => lot.inspection?.decisionOutcome ?? mapDecisionOutcome(lot.inspection?.decisionStatus)).filter(
    (outcome): outcome is AdminDecisionOutcome => Boolean(outcome),
  );
  const allLotsDecided = lots.length > 0 && lotOutcomes.length === lots.length;
  const latestDecisionLot =
    allLotsDecided
      ? [...lots]
          .filter((lot) => lot.inspection?.decisionAt)
          .sort(
            (left, right) =>
              Number(new Date(right.inspection?.decisionAt ?? 0)) - Number(new Date(left.inspection?.decisionAt ?? 0)),
          )[0] ?? null
      : null;

  const allLotsOperationsComplete =
    lots.length > 0 &&
    lots.every((lot) => {
      const capturedCategories = new Set(
        (lot.mediaFiles ?? [])
          .map((file) => normalizeEvidenceCategoryKey(file.category))
          .filter((category): category is NonNullable<typeof category> => Boolean(category)),
      );
      const requiredCategories = resolveRequiredImageUploadCategories(settings.images.requiredImageCategories);
      const requiredImagesDone = requiredCategories.every((category) => {
        return capturedCategories.has(category);
      });
      const decisionOutcome = lot.inspection?.decisionOutcome ?? mapDecisionOutcome(lot.inspection?.decisionStatus);
      const sample = lot.sample;
      const packets = sample?.packets ?? [];
      const sealDone = Boolean(sample?.sealLabel?.sealNo || lot.sealNumber);
      const homogeneousDone = Boolean(sample?.homogeneousProofDone || sample?.homogenizedAt);
      const packetsReady = packets.length > 0 && packets.every((packet) => Boolean(packet.packetWeight && packet.packetUnit));

      return requiredImagesDone && decisionOutcome === "PASS" && Boolean(sample?.id) && homogeneousDone && sealDone && packetsReady;
    });

  const allPackets = lots.flatMap((lot) => lot.sample?.packets ?? []);
  const allPacketsSubmitted =
    allPackets.length > 0 && allPackets.every((packet) => Boolean(packet.submittedToRndAt));
  const latestSubmittedPacket =
    allPacketsSubmitted
      ? [...allPackets]
          .filter((packet) => packet.submittedToRndAt)
          .sort(
            (left, right) =>
              Number(new Date(right.submittedToRndAt ?? 0)) - Number(new Date(left.submittedToRndAt ?? 0)),
          )[0] ?? null
      : null;

  const updateData: Prisma.InspectionJobUpdateInput = {};

  if (!job.jobStartedAt && firstLotCreatedAt) {
    updateData.jobStartedAt = firstLotCreatedAt;
  }
  if (!job.sentToAdminAt && latestSubmittedLot?.inspection?.sentToAdminAt) {
    updateData.sentToAdminAt = latestSubmittedLot.inspection.sentToAdminAt;
    updateData.sentToAdminBy = latestSubmittedLot.inspection.sentToAdminBy ?? null;
  }
  if (allLotsDecided) {
    updateData.adminDecisionAt = latestDate(lots.map((lot) => lot.inspection?.decisionAt));
    updateData.adminDecisionBy = latestDecisionLot?.inspection?.decisionBy ?? null;
    updateData.adminDecisionStatus = getDecisionRollup(lotOutcomes);
  }
  if (!job.operationsCompletedAt && allLotsOperationsComplete) {
    updateData.operationsCompletedAt = new Date();
  }
  if (!job.handedOverToRndAt && latestSubmittedPacket?.submittedToRndAt) {
    updateData.handedOverToRndAt = latestSubmittedPacket.submittedToRndAt;
    updateData.handedOverToRndBy = latestSubmittedPacket.submittedToRndBy ?? null;
    if (options?.handedOverToRndTo?.trim()) {
      updateData.handedOverToRndTo = options.handedOverToRndTo.trim();
    } else if (!job.handedOverToRndTo) {
      updateData.handedOverToRndTo = null;
    }
  }

  return updateData;
}

export async function recomputeJobWorkflowMilestones(
  tx: PrismaLike,
  input: { jobId: string; companyId: string; handedOverToRndTo?: string | null },
) {
  const [settingsRecord, job] = await Promise.all([
    tx.moduleWorkflowSettings.upsert({
      where: { companyId: input.companyId },
      update: {},
      create: buildModuleWorkflowSettingsCreate(input.companyId),
    }),
    tx.inspectionJob.findUnique({
      where: { id: input.jobId },
      select: {
        id: true,
        companyId: true,
        createdAt: true,
        jobStartedAt: true,
        sentToAdminAt: true,
        sentToAdminBy: true,
        adminDecisionAt: true,
        adminDecisionBy: true,
        adminDecisionStatus: true,
        operationsCompletedAt: true,
        handedOverToRndAt: true,
        handedOverToRndBy: true,
        handedOverToRndTo: true,
        lots: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            createdAt: true,
            lotNumber: true,
            sealNumber: true,
            mediaFiles: {
              select: {
                category: true,
              },
            },
            inspection: {
              select: {
                sentToAdminAt: true,
                sentToAdminBy: true,
                decisionAt: true,
                decisionBy: true,
                decisionOutcome: true,
                decisionStatus: true,
              },
            },
            sample: {
              select: {
                id: true,
                homogeneousProofDone: true,
                homogenizedAt: true,
                sealLabel: {
                  select: {
                    sealNo: true,
                  },
                },
                packets: {
                  select: {
                    id: true,
                    packetWeight: true,
                    packetUnit: true,
                    submittedToRndAt: true,
                    submittedToRndBy: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  if (!job || job.companyId !== input.companyId) {
    return null;
  }

  const settings = toModuleWorkflowPolicy(settingsRecord);
  const updateData = computeJobWorkflowMilestoneUpdate(job, settings, {
    handedOverToRndTo: input.handedOverToRndTo,
  });

  if (Object.keys(updateData).length === 0) {
    return job;
  }

  return tx.inspectionJob.update({
    where: { id: job.id },
    data: updateData,
  });
}
