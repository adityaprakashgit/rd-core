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
  it("marks lot with bag proof as eligible", () => {
    const rows = buildSealReadinessRows([
      makeLot({
        mediaFiles: [
          {
            id: "m-1",
            category: "BAG_WITH_LOT_NO",
            storageKey: "/bag.jpg",
            fileName: "bag.jpg",
            createdAt: new Date(),
          },
        ],
      }),
    ]);

    expect(rows[0]?.eligible).toBe(true);
    expect(rows[0]?.reason).toBe("Ready for generation.");
  });

  it("marks lot without bag proof as blocked", () => {
    const rows = buildSealReadinessRows([
      makeLot({
        mediaFiles: [],
      }),
    ]);

    expect(rows[0]?.eligible).toBe(false);
    expect(rows[0]?.reason).toBe("Bag proof is required before seal assignment.");
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
