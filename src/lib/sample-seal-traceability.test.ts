import { describe, expect, it, vi } from "vitest";

import { syncSampleSealTraceability } from "./sample-seal-traceability";

describe("syncSampleSealTraceability", () => {
  it("backfills sample seal traceability from the lot seal number", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "sample-1",
      sealLabel: null,
    });
    const upsert = vi.fn().mockResolvedValue(undefined);
    const tx = {
      sample: { findUnique },
      sampleSealLabel: { upsert },
    } as never;

    const result = await syncSampleSealTraceability(tx, {
      sampleId: "sample-1",
      sealNumber: "1234567890123456",
    });

    expect(result).toBe(true);
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sample-1" },
      }),
    );
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sampleId: "sample-1" },
        update: expect.objectContaining({
          sealNo: "1234567890123456",
          sealStatus: "COMPLETED",
        }),
        create: expect.objectContaining({
          sampleId: "sample-1",
          sealNo: "1234567890123456",
          sealStatus: "COMPLETED",
        }),
      }),
    );
  });

  it("does not overwrite an already synced seal traceability row", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "sample-1",
      sealLabel: {
        sealNo: "1234567890123456",
        sealedAt: new Date("2026-04-19T10:00:00.000Z"),
      },
    });
    const upsert = vi.fn();
    const tx = {
      sample: { findUnique },
      sampleSealLabel: { upsert },
    } as never;

    const result = await syncSampleSealTraceability(tx, {
      sampleId: "sample-1",
      sealNumber: "1234567890123456",
    });

    expect(result).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });
});
