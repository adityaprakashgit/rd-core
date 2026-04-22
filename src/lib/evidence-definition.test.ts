import { describe, expect, it } from "vitest";

import {
  WORKFLOW_EVIDENCE_GROUPS,
  getUploadCategoryKey,
  isCanonicalEvidenceCategoryKey,
  normalizeEvidenceCategoryKey,
} from "./evidence-definition";

describe("evidence-definition label mapping", () => {
  it("maps canonical sealed bag label to supported upload category", () => {
    expect(getUploadCategoryKey("Sealed bag")).toBe("SEALED_BAG");
  });

  it("maps legacy sample completion label to supported upload category", () => {
    expect(getUploadCategoryKey("Sample Completion")).toBe("SEALED_BAG");
  });

  it("maps sealed sample label to supported upload category", () => {
    expect(getUploadCategoryKey("Sealed sample photo")).toBe("SEALED_BAG");
  });

  it("normalizes BAG alias key to canonical BAG_WITH_LOT_NO", () => {
    expect(normalizeEvidenceCategoryKey("BAG")).toBe("BAG_WITH_LOT_NO");
  });

  it("accepts canonical category keys only", () => {
    expect(isCanonicalEvidenceCategoryKey("BAG_WITH_LOT_NO")).toBe(true);
    expect(isCanonicalEvidenceCategoryKey("Bag photo with visible bag no")).toBe(false);
  });

  it("exposes the batch, bag, and sample packet evidence groups", () => {
    expect(WORKFLOW_EVIDENCE_GROUPS.map((group) => group.title)).toEqual([
      "Batch evidence",
      "Bag evidence",
      "Sample packet evidence",
    ]);
  });
});
