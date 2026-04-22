import { canApproveFinalDecision, type ModuleWorkflowPolicy } from "@/lib/module-workflow-policy";
import { getMissingRequiredImageProofLabels } from "@/lib/image-proof-policy";
import { getInspectionSamplingDisplayStatus } from "@/lib/sample-management";
import type { PacketRecord, PublicUser, SampleEventRecord } from "@/types/inspection";

type WorkflowJobLot = {
  id: string;
  lotNumber: string;
  status?: string | null;
  createdAt: string | Date;
  mediaFiles?: Array<{ category: string }>;
  inspection?: {
    inspectionStatus?: string | null;
    decisionStatus?: string | null;
    samplingBlockedFlag?: boolean | null;
    overallRemark?: string | null;
  } | null;
  sealNumber?: string | null;
  assignedBy?: PublicUser | null;
  sample?: {
    homogeneousProofDone?: boolean;
    homogenizedAt?: string | Date | null;
    sealLabel?: { sealNo?: string | null; sealStatus?: string | null } | null;
    packets?: PacketRecord[];
    events?: SampleEventRecord[];
  } | null;
};

type SummaryInputJob = {
  id: string;
  createdAt: string | Date;
  jobStartedAt?: string | Date | null;
  sentToAdminAt?: string | Date | null;
  sentToAdminBy?: string | null;
  finalDecisionStatus?: string | null;
  finalDecisionAt?: string | Date | null;
  finalDecisionBy?: string | null;
  finalDecisionNote?: string | null;
  adminDecisionAt?: string | Date | null;
  adminDecisionBy?: string | null;
  adminDecisionStatus?: string | null;
  operationsCompletedAt?: string | Date | null;
  handedOverToRndAt?: string | Date | null;
  handedOverToRndBy?: string | null;
  handedOverToRndTo?: string | null;
  deadline?: string | Date | null;
  lots?: WorkflowJobLot[];
  samples?: Array<
    NonNullable<WorkflowJobLot["sample"]> & {
      lotId?: string | null;
    }
  >;
  createdByUser?: PublicUser | null;
  assignedTo?: PublicUser | null;
};

export function buildWorkflowSummary(
  job: SummaryInputJob,
  settings: ModuleWorkflowPolicy,
  currentUserRole?: string,
) {
  const firstLot = job.lots?.[0] ?? null;
  const activeLot =
    job.lots?.find((lot: WorkflowJobLot) => lot.status !== "READY_FOR_RND" && lot.status !== "LOCKED") ??
    firstLot;
  const jobSample = job.samples?.[0] ?? null;
  const sample = jobSample ?? activeLot?.sample ?? null;
  const packets = sample?.packets ?? [];
  const inspection = activeLot?.inspection ?? null;
  const jobSealNumbers = (job.lots ?? []).map((lot) => lot.sample?.sealLabel?.sealNo ?? lot.sealNumber ?? null);
  const hasAnyJobSeal = jobSealNumbers.some((sealNumber) => Boolean(sealNumber?.trim()));
  const allLotsReadyForSampling = Boolean(job.lots?.length) && (job.lots ?? []).every((lot) =>
    getInspectionSamplingDisplayStatus(lot.inspection) === "READY_FOR_SAMPLING",
  );
  const samplingBlockedLots = (job.lots ?? [])
    .filter((lot) => getInspectionSamplingDisplayStatus(lot.inspection) !== "READY_FOR_SAMPLING")
    .map((lot) => lot.lotNumber);
  const finalDecisionStatus = job.finalDecisionStatus ?? inspection?.decisionStatus ?? null;
  const finalDecisionNote = job.finalDecisionNote ?? inspection?.overallRemark ?? null;
  const sealAssigned = Boolean(sample?.sealLabel?.sealNo || hasAnyJobSeal);
  const missingRequiredImageProof = activeLot
    ? getMissingRequiredImageProofLabels(
        settings.images.requiredImageCategories,
        (activeLot.mediaFiles ?? []).map((file) => file.category),
      )
    : [];
  const blockers: string[] = [];

  if (!job.lots?.length) {
    blockers.push("Add at least one lot to begin workflow execution.");
  }
  if (activeLot && !inspection) {
    blockers.push("Initialize inspection before decision review.");
  }
  if (activeLot && missingRequiredImageProof.length > 0) {
    blockers.push(`Capture required proof before decision review: ${missingRequiredImageProof.join(", ")}.`);
  }
  if (activeLot && !sealAssigned) {
    blockers.push("Seal assignment is required in Seal step before decision submission.");
  }
  if (settings.workflow.decisionRequiredBeforeSampling && finalDecisionStatus !== "READY_FOR_SAMPLING") {
    blockers.push("Final decision must be passed by the configured approver before sampling.");
  }
  if (!allLotsReadyForSampling && job.lots?.length) {
    blockers.push(`All lots must pass inspection before homogeneous sampling. Blocking lots: ${samplingBlockedLots.join(", ")}.`);
  }
  if (sample && !sample.homogeneousProofDone && !sample.homogenizedAt) {
    blockers.push("Homogeneous proof is still pending.");
  }
  if (sample && !sealAssigned) {
    blockers.push("Seal mapping is incomplete.");
  }
  if (packets.some((packet: PacketRecord) => !packet.packetWeight || !packet.packetUnit)) {
    blockers.push("Every packet needs weight and unit before Submit to R&D.");
  }

  const nextAction = !job.lots?.length
    ? "Add Lot"
    : missingRequiredImageProof.length > 0
      ? "Save Images and Continue"
      : !sealAssigned
        ? "Assign Seal"
        : settings.workflow.decisionRequiredBeforeSampling && finalDecisionStatus !== "READY_FOR_SAMPLING"
          ? canApproveFinalDecision(currentUserRole, settings.workflow.finalDecisionApproverPolicy)
            ? "Pass / Hold / Reject"
            : "Submit for Decision"
          : !allLotsReadyForSampling
            ? "Resolve Lot Inspection"
          : !sample
            ? "Start Sampling"
            : !sample.homogeneousProofDone && !sample.homogenizedAt
              ? "Mark Homogeneous Proof"
              : packets.length === 0
                ? "Create Packets"
                : packets.some((packet: PacketRecord) => !packet.submittedToRndAt)
                  ? settings.workflow.submitToRndEnabled
                    ? "Submit to R&D"
                    : "R&D Submit Disabled"
                  : "Workflow Complete";

  const history = [
    {
      id: `job-created-${job.id}`,
      label: "Job created",
      timestamp: job.createdAt,
      actor: job.createdByUser?.profile?.displayName ?? "System",
    },
    ...(job.lots ?? []).flatMap((lot: WorkflowJobLot) => [
      {
        id: `lot-created-${lot.id}`,
        label: `Lot ${lot.lotNumber} added`,
        timestamp: lot.createdAt,
        actor: lot.assignedBy?.profile?.displayName ?? job.createdByUser?.profile?.displayName ?? "System",
      },
      ...(lot.sample?.events ?? []).map((event: SampleEventRecord) => ({
        id: event.id,
        label: event.eventType.replaceAll("_", " "),
        timestamp: event.eventTime,
        actor: event.performedBy?.profile?.displayName ?? "System",
      })),
    ]),
  ].sort((left, right) => Number(new Date(right.timestamp)) - Number(new Date(left.timestamp)));

  return {
    workflowStage: nextAction === "Workflow Complete" ? "Submit to R&D" : nextAction,
    nextAction,
    blockers,
    images: activeLot?.mediaFiles ?? [],
    decision: finalDecisionStatus
      ? {
          status: finalDecisionStatus,
          note: finalDecisionNote,
        }
      : null,
    sample,
    sealMapping: {
      lotId: activeLot?.id ?? null,
      lotNumber: activeLot?.lotNumber ?? null,
      sealNumber: sample?.sealLabel?.sealNo ?? jobSealNumbers.find((sealNumber) => Boolean(sealNumber?.trim())) ?? activeLot?.sealNumber ?? null,
      status: sample?.sealLabel?.sealStatus ?? (hasAnyJobSeal ? "COMPLETED" : "PENDING"),
    },
    packets,
    assignment: {
      createdBy: job.createdByUser?.profile?.displayName ?? null,
      assignedTo: job.assignedTo?.profile?.displayName ?? null,
      deadline: job.deadline,
    },
    milestones: {
      jobCreatedAt: job.createdAt,
      jobStartedAt: job.jobStartedAt,
      sentToAdminAt: job.sentToAdminAt,
      sentToAdminBy: job.sentToAdminBy,
      adminDecisionAt: job.adminDecisionAt,
      adminDecisionBy: job.adminDecisionBy,
      adminDecisionStatus: job.adminDecisionStatus,
      operationsCompletedAt: job.operationsCompletedAt,
      handedOverToRndAt: job.handedOverToRndAt,
      handedOverToRndBy: job.handedOverToRndBy,
      handedOverToRndTo: job.handedOverToRndTo,
      handedOverToRndToLabel: null,
    },
    history,
  };
}
