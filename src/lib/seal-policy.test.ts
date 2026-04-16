import { describe, expect, it } from "vitest";

import {
  evaluateSealAssignmentPrerequisites,
  getSealAssignmentPolicy,
} from "./seal-policy";

describe("seal policy", () => {
  it("defaults to EVIDENCE_READY", () => {
    expect(getSealAssignmentPolicy(undefined)).toBe("EVIDENCE_READY");
    expect(getSealAssignmentPolicy("invalid")).toBe("EVIDENCE_READY");
  });

  it("blocks when job is locked", () => {
    const block = evaluateSealAssignmentPrerequisites({
      policy: "OPEN",
      jobStatus: "LOCKED",
      inspectionStatus: "COMPLETED",
      decisionStatus: "READY_FOR_SAMPLING",
      bagPhotoUrl: "/x.jpg",
      samplingPhotoUrl: "/y.jpg",
    });

    expect(block).toMatchObject({
      status: 403,
      code: "SEAL_JOB_LOCKED",
    });
  });

  it("applies same prerequisites regardless of auto/manual path input", () => {
    const autoPathBlock = evaluateSealAssignmentPrerequisites({
      policy: "EVIDENCE_READY",
      jobStatus: "IN_PROGRESS",
      inspectionStatus: "IN_PROGRESS",
      decisionStatus: "PENDING",
      bagPhotoUrl: null,
      samplingPhotoUrl: "/sampling.jpg",
    });

    const manualPathBlock = evaluateSealAssignmentPrerequisites({
      policy: "EVIDENCE_READY",
      jobStatus: "IN_PROGRESS",
      inspectionStatus: "IN_PROGRESS",
      decisionStatus: "PENDING",
      bagPhotoUrl: null,
      samplingPhotoUrl: "/sampling.jpg",
    });

    expect(autoPathBlock).toEqual(manualPathBlock);
    expect(autoPathBlock?.code).toBe("SEAL_PREREQ_BAG_PHOTO_MISSING");
  });

  it("allows assignment when bag proof policy is satisfied", () => {
    const block = evaluateSealAssignmentPrerequisites({
      policy: "EVIDENCE_READY",
      jobStatus: "IN_PROGRESS",
      inspectionStatus: "IN_PROGRESS",
      decisionStatus: "PENDING",
      bagPhotoUrl: "/bag.jpg",
      samplingPhotoUrl: null,
    });

    expect(block).toBeNull();
  });
});
