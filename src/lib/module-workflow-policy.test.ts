import { describe, expect, it } from "vitest";

import {
  buildModuleWorkflowSettingsUpdate,
  defaultModuleWorkflowSettings,
  repairEmptyImagePolicyBuckets,
  toModuleWorkflowPolicy,
  validateImagePolicyCategoryBuckets,
} from "./module-workflow-policy";

describe("module workflow image policy hardening", () => {
  it("repairs image buckets when all are empty", () => {
    const repaired = repairEmptyImagePolicyBuckets({
      requiredImageCategories: [],
      optionalImageCategories: [],
      hiddenImageCategories: [],
    });

    expect(repaired.requiredImageCategories).toEqual(defaultModuleWorkflowSettings.requiredImageCategories);
    expect(repaired.optionalImageCategories).toEqual(defaultModuleWorkflowSettings.optionalImageCategories);
    expect(repaired.hiddenImageCategories).toEqual(defaultModuleWorkflowSettings.hiddenImageCategories);
  });

  it("keeps custom image buckets unchanged when at least one bucket is populated", () => {
    const custom = {
      requiredImageCategories: [],
      optionalImageCategories: ["LOT_OVERVIEW"],
      hiddenImageCategories: [],
    };
    expect(repairEmptyImagePolicyBuckets(custom)).toEqual(custom);
  });

  it("toModuleWorkflowPolicy auto-heals all-empty image buckets", () => {
    const policy = toModuleWorkflowPolicy({
      ...defaultModuleWorkflowSettings,
      requiredImageCategories: [],
      optionalImageCategories: [],
      hiddenImageCategories: [],
    });

    expect(policy.images.requiredImageCategories.length).toBeGreaterThan(0);
    expect(policy.images.optionalImageCategories).toEqual(defaultModuleWorkflowSettings.optionalImageCategories);
  });

  it("buildModuleWorkflowSettingsUpdate heals explicit all-NONE payload", () => {
    const update = buildModuleWorkflowSettingsUpdate({
      images: {
        requiredImageCategories: [],
        optionalImageCategories: [],
        hiddenImageCategories: [],
        imageTimestampRequired: false,
      },
    });

    expect(update.requiredImageCategories).toEqual(defaultModuleWorkflowSettings.requiredImageCategories);
    expect(update.optionalImageCategories).toEqual(defaultModuleWorkflowSettings.optionalImageCategories);
    expect(update.hiddenImageCategories).toEqual(defaultModuleWorkflowSettings.hiddenImageCategories);
  });

  it("flags non-canonical image categories on write validation", () => {
    const issues = validateImagePolicyCategoryBuckets({
      images: {
        requiredImageCategories: ["Bag photo with visible LOT no"],
        optionalImageCategories: [],
        hiddenImageCategories: [],
        imageTimestampRequired: false,
      },
    });

    expect(issues).toEqual([
      { bucket: "requiredImageCategories", value: "Bag photo with visible LOT no" },
    ]);
  });
});
