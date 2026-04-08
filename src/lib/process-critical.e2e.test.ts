import { describe, expect, it } from "vitest";

import { evaluateSamplingWriteGate } from "./sampling-gate";
import { evaluateSealAssignmentPrerequisites } from "./seal-policy";
import {
  getExportPolicyBlockReason,
  getReportExportStagePolicy,
  isExportStageAllowed,
} from "./report-export-policy";
import { MOBILE_ACTION_RAIL_BOTTOM_OFFSET, MOBILE_CONTENT_BOTTOM_PADDING } from "./mobile-bottom-ui";

describe("critical process e2e coverage", () => {
  it("allows happy path across sampling gate, seal guard, and export policy", () => {
    const samplingGate = evaluateSamplingWriteGate({
      lotExists: true,
      lotCompanyId: "company-1",
      userCompanyId: "company-1",
      jobStatus: "IN_PROGRESS",
      inspectionStatus: "COMPLETED",
      decisionStatus: "READY_FOR_SAMPLING",
    });
    expect(samplingGate).toBeNull();

    const sealGuard = evaluateSealAssignmentPrerequisites({
      policy: "EVIDENCE_READY",
      jobStatus: "IN_PROGRESS",
      inspectionStatus: "COMPLETED",
      decisionStatus: "READY_FOR_SAMPLING",
      bagPhotoUrl: "/uploads/bag.jpg",
      samplingPhotoUrl: "/uploads/sampling.jpg",
    });
    expect(sealGuard).toBeNull();

    const policy = getReportExportStagePolicy("LOCKED_ONLY");
    expect(policy).toBe("LOCKED_ONLY");
    expect(isExportStageAllowed(policy, "LOCKED")).toBe(true);
  });

  it("blocks key invalid states with deterministic reason codes", () => {
    const samplingGate = evaluateSamplingWriteGate({
      lotExists: true,
      lotCompanyId: "company-1",
      userCompanyId: "company-1",
      jobStatus: "LOCKED",
      inspectionStatus: "COMPLETED",
      decisionStatus: "READY_FOR_SAMPLING",
    });
    expect(samplingGate?.code).toBe("SAMPLING_JOB_LOCKED");

    const sealGuard = evaluateSealAssignmentPrerequisites({
      policy: "EVIDENCE_READY",
      jobStatus: "IN_PROGRESS",
      inspectionStatus: "COMPLETED",
      decisionStatus: "READY_FOR_SAMPLING",
      bagPhotoUrl: null,
      samplingPhotoUrl: "/uploads/sampling.jpg",
    });
    expect(sealGuard?.code).toBe("SEAL_PREREQ_BAG_PHOTO_MISSING");

    const exportPolicy = getReportExportStagePolicy("QA_APPROVED");
    expect(isExportStageAllowed(exportPolicy, "IN_PROGRESS")).toBe(false);
    expect(getExportPolicyBlockReason(exportPolicy).code).toBe("EXPORT_POLICY_QA_APPROVAL_REQUIRED");
  });

  it("keeps mobile viewport spacing guards for bottom nav and action rail", () => {
    expect(MOBILE_ACTION_RAIL_BOTTOM_OFFSET).toContain("safe-area-inset-bottom");
    expect(MOBILE_ACTION_RAIL_BOTTOM_OFFSET).toContain("72px");
    expect(MOBILE_CONTENT_BOTTOM_PADDING).toContain("safe-area-inset-bottom");
    expect(MOBILE_CONTENT_BOTTOM_PADDING).toContain("56px");
  });
});
