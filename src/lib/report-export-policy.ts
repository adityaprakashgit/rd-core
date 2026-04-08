export const EXPORT_STAGE_POLICIES = ["VALIDATED_ONLY", "QA_APPROVED", "LOCKED_ONLY"] as const;

export type ExportStagePolicy = (typeof EXPORT_STAGE_POLICIES)[number];

const QA_APPROVED_STATUSES = new Set(["LOCKED", "REPORT_READY", "COMPLETED", "DISPATCHED"]);

/**
 * REPORT_EXPORT_STAGE_POLICY controls export gating.
 * Supported values: VALIDATED_ONLY | QA_APPROVED | LOCKED_ONLY.
 * Defaults to VALIDATED_ONLY when unset or invalid.
 */
export function getReportExportStagePolicy(raw: string | null | undefined = process.env.REPORT_EXPORT_STAGE_POLICY): ExportStagePolicy {
  const normalized = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (normalized === "QA_APPROVED" || normalized === "LOCKED_ONLY" || normalized === "VALIDATED_ONLY") {
    return normalized;
  }
  return "VALIDATED_ONLY";
}

export function isExportStageAllowed(policy: ExportStagePolicy, jobStatus: string | null | undefined): boolean {
  const normalizedStatus = typeof jobStatus === "string" ? jobStatus.trim().toUpperCase() : "";

  if (policy === "VALIDATED_ONLY") {
    return true;
  }

  if (policy === "QA_APPROVED") {
    return QA_APPROVED_STATUSES.has(normalizedStatus);
  }

  return normalizedStatus === "LOCKED";
}

export function getExportPolicyBlockReason(policy: ExportStagePolicy): { details: string; code: string } {
  if (policy === "QA_APPROVED") {
    return {
      details: "Export requires QA approval. Move the job to LOCKED/REPORT_READY/COMPLETED/DISPATCHED before export.",
      code: "EXPORT_POLICY_QA_APPROVAL_REQUIRED",
    };
  }

  if (policy === "LOCKED_ONLY") {
    return {
      details: "Export is permitted only when the job status is LOCKED.",
      code: "EXPORT_POLICY_LOCK_REQUIRED",
    };
  }

  return {
    details: "Export policy blocked this request.",
    code: "EXPORT_POLICY_BLOCKED",
  };
}
