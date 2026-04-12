import { describe, expect, it } from "vitest";

import { buildDecisionValidation, deriveInspectionAssessment } from "./inspection-checklist";

describe("inspection decision media gating", () => {
  it("allows pass when required proof exists on combined lot/inspection media categories", () => {
    const assessment = deriveInspectionAssessment({
      items: [],
      responses: [],
      issues: [],
      mediaCategories: ["BAG_WITH_LOT_NO"],
      requiredMediaCategories: ["BAG_WITH_LOT_NO"],
    });

    const errors = buildDecisionValidation({
      decisionStatus: "READY_FOR_SAMPLING",
      assessment,
      issues: [],
      overallRemark: "All checks complete",
    });

    expect(assessment.missingRequiredMedia).toEqual([]);
    expect(errors).toEqual([]);
  });

  it("blocks pass when required proof is missing", () => {
    const assessment = deriveInspectionAssessment({
      items: [],
      responses: [],
      issues: [],
      mediaCategories: [],
      requiredMediaCategories: ["BAG_WITH_LOT_NO"],
    });

    const errors = buildDecisionValidation({
      decisionStatus: "READY_FOR_SAMPLING",
      assessment,
      issues: [],
      overallRemark: "Attempting pass",
    });

    expect(assessment.missingRequiredMedia).toEqual(["BAG_WITH_LOT_NO"]);
    expect(errors).toContain("Upload all required inspection media before marking the lot ready for sampling.");
  });

  it("keeps hold/reject note validation unchanged", () => {
    const assessment = deriveInspectionAssessment({
      items: [],
      responses: [],
      issues: [],
      mediaCategories: ["BAG_WITH_LOT_NO"],
      requiredMediaCategories: ["BAG_WITH_LOT_NO"],
    });

    const errors = buildDecisionValidation({
      decisionStatus: "REJECTED",
      assessment,
      issues: [
        {
          id: "iss-1",
          inspectionId: "insp-1",
          issueCategory: "Other",
          severity: "MODERATE",
          description: "Mismatch",
          status: "OPEN",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      overallRemark: "",
    });

    expect(errors).toContain("Remarks are required for rejected lots.");
  });
});
