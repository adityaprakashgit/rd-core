import {
  Prisma,
  WorkflowEscalationSeverity,
  WorkflowEscalationStatus,
  WorkflowEscalationType,
} from "@prisma/client";

import { prisma } from "./prisma";

export type WorkflowEscalationCreateInput = {
  companyId: string;
  type: WorkflowEscalationType;
  title: string;
  severity?: WorkflowEscalationSeverity;
  status?: WorkflowEscalationStatus;
  detailsJson?: Prisma.InputJsonValue;
  overrideReason?: string | null;
  jobId?: string | null;
  lotId?: string | null;
  raisedByUserId?: string | null;
  assignedToUserId?: string | null;
  resolutionNote?: string | null;
};

export function buildWorkflowEscalationCreateData(
  input: WorkflowEscalationCreateInput,
): Prisma.WorkflowEscalationUncheckedCreateInput {
  return {
    companyId: input.companyId,
    type: input.type,
    severity: input.severity ?? WorkflowEscalationSeverity.MEDIUM,
    status: input.status ?? WorkflowEscalationStatus.OPEN,
    title: input.title,
    detailsJson: input.detailsJson,
    overrideReason: input.overrideReason ?? null,
    resolutionNote: input.resolutionNote ?? null,
    jobId: input.jobId ?? null,
    lotId: input.lotId ?? null,
    raisedByUserId: input.raisedByUserId ?? null,
    assignedToUserId: input.assignedToUserId ?? null,
    resolvedAt: input.status === WorkflowEscalationStatus.RESOLVED ? new Date() : null,
  };
}

export async function createWorkflowEscalation(
  input: WorkflowEscalationCreateInput,
  tx?: Prisma.TransactionClient,
) {
  const client = tx ?? prisma;
  return client.workflowEscalation.create({
    data: buildWorkflowEscalationCreateData(input),
  });
}

export async function enqueueWorkflowEscalationSafe(
  input: WorkflowEscalationCreateInput,
  tx?: Prisma.TransactionClient,
) {
  try {
    return await createWorkflowEscalation(input, tx);
  } catch (error) {
    console.warn("[workflow-escalation] Failed to enqueue escalation", error);
    return null;
  }
}

export function buildDuplicateJobEscalation(input: {
  companyId: string;
  raisedByUserId: string;
  sourceName: string;
  materialCategory: string;
  sourceLocation: string | null;
  duplicateWindowHours: number;
  duplicateCandidates: Array<{
    id: string;
    inspectionSerialNumber: string;
    jobReferenceNumber: string | null;
    status: string;
    createdAt: Date;
  }>;
  overrideRequested: boolean;
}) {
  return buildWorkflowEscalationCreateData({
    companyId: input.companyId,
    raisedByUserId: input.raisedByUserId,
    type: WorkflowEscalationType.DUPLICATE_JOB,
    severity: WorkflowEscalationSeverity.MEDIUM,
    title: `Potential duplicate job: ${input.sourceName} / ${input.materialCategory}`,
    detailsJson: {
      sourceName: input.sourceName,
      materialCategory: input.materialCategory,
      sourceLocation: input.sourceLocation,
      duplicateWindowHours: input.duplicateWindowHours,
      overrideRequested: input.overrideRequested,
      duplicateCandidates: input.duplicateCandidates.map((candidate) => ({
        id: candidate.id,
        inspectionSerialNumber: candidate.inspectionSerialNumber,
        jobReferenceNumber: candidate.jobReferenceNumber,
        status: candidate.status,
        createdAt: candidate.createdAt.toISOString(),
      })),
    },
  });
}

export function buildLotConflictEscalation(input: {
  companyId: string;
  raisedByUserId: string;
  jobId: string;
  lotId: string;
  expectedUpdatedAt: string;
  actualUpdatedAt: string;
}) {
  return buildWorkflowEscalationCreateData({
    companyId: input.companyId,
    raisedByUserId: input.raisedByUserId,
    jobId: input.jobId,
    lotId: input.lotId,
    type: WorkflowEscalationType.LOT_CONFLICT,
    severity: WorkflowEscalationSeverity.HIGH,
    title: "Lot update conflict detected",
    detailsJson: {
      expectedUpdatedAt: input.expectedUpdatedAt,
      actualUpdatedAt: input.actualUpdatedAt,
    },
  });
}

export function buildPackingPolicyBlockedEscalation(input: {
  companyId: string;
  raisedByUserId: string;
  jobId: string;
  jobStatus: string;
  policyCode: string;
  policyDetails: string;
}) {
  return buildWorkflowEscalationCreateData({
    companyId: input.companyId,
    raisedByUserId: input.raisedByUserId,
    jobId: input.jobId,
    type: WorkflowEscalationType.PACKING_POLICY_BLOCK,
    severity: WorkflowEscalationSeverity.MEDIUM,
    title: "Packing list blocked by export policy",
    detailsJson: {
      jobStatus: input.jobStatus,
      policyCode: input.policyCode,
      policyDetails: input.policyDetails,
    },
  });
}
