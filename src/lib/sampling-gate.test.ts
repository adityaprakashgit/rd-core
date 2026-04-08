import { describe, expect, it } from "vitest";

import { evaluateSamplingWriteGate } from "./sampling-gate";

const baseInput = {
  lotExists: true,
  lotCompanyId: "company-1",
  userCompanyId: "company-1",
  jobStatus: "IN_PROGRESS",
  inspectionStatus: "COMPLETED",
  decisionStatus: "READY_FOR_SAMPLING",
} as const;

describe("evaluateSamplingWriteGate", () => {
  it("returns the same lock gate result for create and update parity paths", () => {
    const createPathResult = evaluateSamplingWriteGate({
      ...baseInput,
      jobStatus: "LOCKED",
    });

    const updatePathResult = evaluateSamplingWriteGate({
      ...baseInput,
      jobStatus: "LOCKED",
    });

    expect(createPathResult).toEqual(updatePathResult);
    expect(createPathResult).toMatchObject({
      status: 403,
      code: "SAMPLING_JOB_LOCKED",
    });
  });

  it("returns the same readiness gate result for create and update parity paths", () => {
    const createPathResult = evaluateSamplingWriteGate({
      ...baseInput,
      inspectionStatus: "IN_PROGRESS",
      decisionStatus: "ON_HOLD",
    });

    const updatePathResult = evaluateSamplingWriteGate({
      ...baseInput,
      inspectionStatus: "IN_PROGRESS",
      decisionStatus: "ON_HOLD",
    });

    expect(createPathResult).toEqual(updatePathResult);
    expect(createPathResult).toMatchObject({
      status: 422,
      code: "SAMPLING_NOT_READY",
    });
  });

  it("allows write when lot is in company scope, unlocked, and sampling-ready", () => {
    const result = evaluateSamplingWriteGate(baseInput);
    expect(result).toBeNull();
  });

  it("returns cross-company forbidden code with standard payload shape", () => {
    const result = evaluateSamplingWriteGate({
      ...baseInput,
      lotCompanyId: "company-2",
    });

    expect(result).toEqual({
      status: 403,
      error: "Forbidden",
      details: "Cross-company access is not allowed.",
      code: "SAMPLING_CROSS_COMPANY_FORBIDDEN",
    });
  });
});
