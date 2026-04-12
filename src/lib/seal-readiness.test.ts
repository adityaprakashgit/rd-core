import { describe, expect, it } from "vitest";

import type { InspectionLot } from "@/types/inspection";

import { buildSealReadinessRows } from "./seal-readiness";

function makeLot(overrides: Partial<InspectionLot>): InspectionLot {
  return {
    id: "lot-1",
    jobId: "job-1",
    lotNumber: "Lot 1",
    totalBags: 1,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("buildSealReadinessRows", () => {
  it("marks READY_FOR_SAMPLING completed inspection lot as eligible", () => {
    const rows = buildSealReadinessRows([
      makeLot({
        inspection: {
          id: "insp-1",
          jobId: "job-1",
          lotId: "lot-1",
          inspectorId: "u-1",
          inspectionStatus: "COMPLETED",
          decisionStatus: "READY_FOR_SAMPLING",
          startedAt: new Date(),
          identityRiskFlag: false,
          packagingRiskFlag: false,
          materialRiskFlag: false,
          samplingBlockedFlag: false,
          issueCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }),
    ]);

    expect(rows[0]?.eligible).toBe(true);
    expect(rows[0]?.reason).toBe("Ready for generation.");
  });

  it("marks non-ready lot with blocker reason", () => {
    const rows = buildSealReadinessRows([
      makeLot({
        inspection: {
          id: "insp-1",
          jobId: "job-1",
          lotId: "lot-1",
          inspectorId: "u-1",
          inspectionStatus: "IN_PROGRESS",
          decisionStatus: "PENDING",
          startedAt: new Date(),
          identityRiskFlag: false,
          packagingRiskFlag: false,
          materialRiskFlag: false,
          samplingBlockedFlag: false,
          issueCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }),
    ]);

    expect(rows[0]?.eligible).toBe(false);
    expect(rows[0]?.reason).toBe("Inspection not completed.");
  });

  it("excludes lots with existing seals", () => {
    const rows = buildSealReadinessRows([
      makeLot({
        sealNumber: "1234567890123456",
      }),
    ]);

    expect(rows[0]?.eligible).toBe(false);
    expect(rows[0]?.alreadyAssigned).toBe(true);
    expect(rows[0]?.reason).toBe("Seal already assigned.");
  });
});
