export type SamplingGateInput = {
  lotExists: boolean;
  lotCompanyId: string | null | undefined;
  userCompanyId: string | null | undefined;
  jobStatus: string | null | undefined;
  inspectionStatus: string | null | undefined;
  decisionStatus: string | null | undefined;
};

export type SamplingGateError = {
  status: number;
  error: string;
  details: string;
  code: string;
};

export function evaluateSamplingWriteGate(input: SamplingGateInput): SamplingGateError | null {
  if (!input.lotExists) {
    return {
      status: 404,
      error: "Not Found",
      details: "The specified Lot does not exist in the system.",
      code: "SAMPLING_LOT_NOT_FOUND",
    };
  }

  if (!input.userCompanyId || input.lotCompanyId !== input.userCompanyId) {
    return {
      status: 403,
      error: "Forbidden",
      details: "Cross-company access is not allowed.",
      code: "SAMPLING_CROSS_COMPANY_FORBIDDEN",
    };
  }

  if (input.jobStatus === "LOCKED") {
    return {
      status: 403,
      error: "Access Forbidden",
      details: "This job is LOCKED for audit integrity. No modifications allowed.",
      code: "SAMPLING_JOB_LOCKED",
    };
  }

  if (input.inspectionStatus !== "COMPLETED" || input.decisionStatus !== "READY_FOR_SAMPLING") {
    return {
      status: 422,
      error: "Validation Error",
      details: "Lot inspection must be completed and marked ready for sampling before sampling can begin.",
      code: "SAMPLING_NOT_READY",
    };
  }

  return null;
}
