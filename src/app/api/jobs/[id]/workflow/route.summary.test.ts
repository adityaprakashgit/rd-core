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
});
