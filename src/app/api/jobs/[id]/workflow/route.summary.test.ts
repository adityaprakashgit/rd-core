import { describe, expect, it } from "vitest";

import { defaultModuleWorkflowSettings, toModuleWorkflowPolicy } from "@/lib/module-workflow-policy";
import { buildWorkflowSummary } from "@/lib/job-workflow-summary";

function makeSettings() {
  const settings = toModuleWorkflowPolicy(defaultModuleWorkflowSettings);
  return {
    ...settings,
    images: {
      ...settings.images,
      requiredImageCategories: [],
      optionalImageCategories: [],
      hiddenImageCategories: [],
    },
  };
}

describe("buildWorkflowSummary seal mapping", () => {
  it("returns Assign Seal when active lot has no seal", () => {
    const summary = buildWorkflowSummary(
      {
        id: "job-1",
        createdAt: new Date(),
        deadline: null,
        lots: [
          {
            id: "lot-1",
            lotNumber: "LOT-1",
            createdAt: new Date(),
            mediaFiles: [],
            inspection: {
              decisionStatus: "PENDING",
              overallRemark: null,
            },
            sample: {
              homogeneousProofDone: false,
              homogenizedAt: null,
              sealLabel: null,
              packets: [],
              events: [],
            },
            sealNumber: null,
          },
        ],
      },
      makeSettings(),
      "OPERATIONS",
    );

    expect(summary.nextAction).toBe("Assign Seal");
    expect(summary.blockers).toContain("Seal assignment is required in Seal step before decision submission.");
  });

  it("treats lot sealNumber as valid seal mapping even when sample sealLabel is missing", () => {
    const summary = buildWorkflowSummary(
      {
        id: "job-2",
        createdAt: new Date(),
        deadline: null,
        lots: [
          {
            id: "lot-2",
            lotNumber: "LOT-2",
            createdAt: new Date(),
            mediaFiles: [],
            inspection: {
              decisionStatus: "PENDING",
              overallRemark: null,
            },
            sample: {
              homogeneousProofDone: true,
              homogenizedAt: new Date(),
              sealLabel: null,
              packets: [],
              events: [],
            },
            sealNumber: "1234567890123456",
          },
        ],
      },
      makeSettings(),
      "OPERATIONS",
    );

    expect(summary.sealMapping.sealNumber).toBe("1234567890123456");
    expect(summary.blockers).not.toContain("Seal mapping is incomplete.");
  });

  it("treats multi-lot job seals as complete even when the job sample sealLabel is missing", () => {
    const summary = buildWorkflowSummary(
      {
        id: "job-5",
        createdAt: new Date(),
        deadline: null,
        lots: [
          {
            id: "lot-5a",
            lotNumber: "LOT-5A",
            createdAt: new Date(),
            mediaFiles: [],
            inspection: {
              decisionStatus: "READY_FOR_SAMPLING",
              overallRemark: null,
            },
            sample: {
              homogeneousProofDone: true,
              homogenizedAt: new Date(),
              sealLabel: null,
              packets: [],
              events: [],
            },
            sealNumber: "1111222233334444",
          },
          {
            id: "lot-5b",
            lotNumber: "LOT-5B",
            createdAt: new Date(),
            mediaFiles: [],
            inspection: {
              decisionStatus: "READY_FOR_SAMPLING",
              overallRemark: null,
            },
            sample: {
              homogeneousProofDone: true,
              homogenizedAt: new Date(),
              sealLabel: null,
              packets: [],
              events: [],
            },
            sealNumber: "5555666677778888",
          },
        ],
      },
      makeSettings(),
      "OPERATIONS",
    );

    expect(summary.blockers).not.toContain("Seal assignment is required in Seal step before decision submission.");
    expect(summary.blockers).not.toContain("Seal mapping is incomplete.");
    expect(summary.sealMapping.status).toBe("COMPLETED");
  });

  it("blocks homogeneous sampling until inspection is completed even when decision is READY_FOR_SAMPLING", () => {
    const summary = buildWorkflowSummary(
      {
        id: "job-3",
        createdAt: new Date(),
        deadline: null,
        lots: [
          {
            id: "lot-3",
            lotNumber: "LOT-3",
            createdAt: new Date(),
            mediaFiles: [],
            inspection: {
              inspectionStatus: "IN_PROGRESS",
              decisionStatus: "READY_FOR_SAMPLING",
              overallRemark: null,
            },
            sample: {
              homogeneousProofDone: true,
              homogenizedAt: new Date(),
              sealLabel: {
                sealNo: "1234567890123456",
              },
              packets: [],
              events: [],
            },
            sealNumber: "1234567890123456",
          },
        ],
      },
      makeSettings(),
      "OPERATIONS",
    );

    expect(summary.blockers).toContain(
      "All lots must pass inspection before homogeneous sampling. Blocking lots: LOT-3.",
    );
    expect(summary.nextAction).toBe("Resolve Lot Inspection");
  });

  it("treats blocked sampling rows as blocked even when the decision status is READY_FOR_SAMPLING", () => {
    const summary = buildWorkflowSummary(
      {
        id: "job-4",
        createdAt: new Date(),
        deadline: null,
        lots: [
          {
            id: "lot-4",
            lotNumber: "LOT-4",
            createdAt: new Date(),
            mediaFiles: [],
            inspection: {
              inspectionStatus: "COMPLETED",
              decisionStatus: "READY_FOR_SAMPLING",
              samplingBlockedFlag: true,
              overallRemark: null,
            },
            sample: {
              homogeneousProofDone: true,
              homogenizedAt: new Date(),
              sealLabel: {
                sealNo: "1234567890123456",
              },
              packets: [],
              events: [],
            },
            sealNumber: "1234567890123456",
          },
        ],
      },
      makeSettings(),
      "OPERATIONS",
    );

    expect(summary.blockers).toContain(
      "All lots must pass inspection before homogeneous sampling. Blocking lots: LOT-4.",
    );
    expect(summary.nextAction).toBe("Resolve Lot Inspection");
  });
});
