export const SEAL_ASSIGNMENT_POLICIES = ["OPEN", "INSPECTION_READY", "EVIDENCE_READY"] as const;

export type SealAssignmentPolicy = (typeof SEAL_ASSIGNMENT_POLICIES)[number];

export type SealPrerequisiteBlock = {
  status: number;
  code: string;
  details: string;
};

/**
 * SEAL_ASSIGNMENT_POLICY controls seal assignment prerequisites.
 * OPEN: no readiness prerequisites beyond auth/scope.
 * INSPECTION_READY: requires inspection completed + decision ready for sampling.
 * EVIDENCE_READY (default): INSPECTION_READY + bag and sampling traceability photos.
 */
export function getSealAssignmentPolicy(raw: string | null | undefined = process.env.SEAL_ASSIGNMENT_POLICY): SealAssignmentPolicy {
  const normalized = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (normalized === "OPEN" || normalized === "INSPECTION_READY" || normalized === "EVIDENCE_READY") {
    return normalized;
  }
  return "EVIDENCE_READY";
}

export function evaluateSealAssignmentPrerequisites(input: {
  policy: SealAssignmentPolicy;
  jobStatus: string | null | undefined;
  inspectionStatus: string | null | undefined;
  decisionStatus: string | null | undefined;
  bagPhotoUrl: string | null | undefined;
  samplingPhotoUrl: string | null | undefined;
}): SealPrerequisiteBlock | null {
  if (input.jobStatus === "LOCKED") {
    return {
      status: 403,
      code: "SEAL_JOB_LOCKED",
      details: "This job is LOCKED for audit integrity. No seal changes are allowed.",
    };
  }

  if (input.policy === "OPEN") {
    return null;
  }

  const inspectionReady = input.inspectionStatus === "COMPLETED" && input.decisionStatus === "READY_FOR_SAMPLING";
  if (!inspectionReady) {
    return {
      status: 422,
      code: "SEAL_PREREQ_INSPECTION_NOT_READY",
      details: "Seal assignment requires inspection completion with READY_FOR_SAMPLING decision.",
    };
  }

  if (input.policy === "EVIDENCE_READY") {
    if (!input.bagPhotoUrl) {
      return {
        status: 422,
        code: "SEAL_PREREQ_BAG_PHOTO_MISSING",
        details: "Seal assignment requires a bag traceability photo.",
      };
    }

    if (!input.samplingPhotoUrl) {
      return {
        status: 422,
        code: "SEAL_PREREQ_SAMPLING_PHOTO_MISSING",
        details: "Seal assignment requires a sampling traceability photo.",
      };
    }
  }

  return null;
}
