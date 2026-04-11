import { describe, expect, it } from "vitest";

import {
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

  it("normalizes BAG alias key to canonical BAG_WITH_LOT_NO", () => {
    expect(normalizeEvidenceCategoryKey("BAG")).toBe("BAG_WITH_LOT_NO");
  });

  it("accepts canonical category keys only", () => {
    expect(isCanonicalEvidenceCategoryKey("BAG_WITH_LOT_NO")).toBe(true);
    expect(isCanonicalEvidenceCategoryKey("Bag photo with visible LOT no")).toBe(false);
  });
});
