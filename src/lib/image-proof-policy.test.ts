import { describe, expect, it } from "vitest";

import {
  getRequiredProofFailureCode,
  resolveEvidenceCategoriesForLot,
  resolveMissingRequiredEvidenceCategories,
  getMissingRequiredImageProofLabels,
  requiresRequiredImageProofForDecision,
  resolveRequiredImageUploadCategories,
} from "./image-proof-policy";

describe("image proof policy helpers", () => {
  it("maps required labels to upload category keys", () => {
    expect(
      resolveRequiredImageUploadCategories([
        "Bag photo with visible bag no",
        "Material in bag",
      ]),
    ).toEqual(["BAG_WITH_LOT_NO", "MATERIAL_VISIBLE"]);
  });

  it("returns missing required labels from uploaded categories", () => {
    expect(
      getMissingRequiredImageProofLabels(
        ["Bag photo with visible bag no", "Material in bag", "Bag condition"],
        ["BAG_WITH_LOT_NO", "BAG_CONDITION"],
      ),
    ).toEqual(["Material in bag"]);
  });

  it("dedupes BAG and BAG_WITH_LOT_NO to canonical bag proof in resolver", () => {
    const resolved = resolveEvidenceCategoriesForLot({
      lotMedia: [{ category: "BAG" }, { category: "BAG_WITH_LOT_NO" }],
    });
    expect(Array.from(resolved)).toEqual(["BAG_WITH_LOT_NO"]);
  });

  it("returns canonical missing categories for unified proof gates", () => {
    const missing = resolveMissingRequiredEvidenceCategories(
      ["BAG_WITH_LOT_NO", "SAMPLING_IN_PROGRESS"],
      new Set(["BAG_WITH_LOT_NO"]),
    );
    expect(missing).toEqual(["SAMPLING_IN_PROGRESS"]);
    expect(getRequiredProofFailureCode(missing)).toBe("PROOF_REQUIRED_MISSING_SAMPLING");
  });

  it("requires complete proof for Submit for Decision and Pass only", () => {
    expect(requiresRequiredImageProofForDecision("PENDING")).toBe(true);
    expect(requiresRequiredImageProofForDecision("READY_FOR_SAMPLING")).toBe(true);
    expect(requiresRequiredImageProofForDecision("ON_HOLD")).toBe(false);
    expect(requiresRequiredImageProofForDecision("REJECTED")).toBe(false);
  });
});
