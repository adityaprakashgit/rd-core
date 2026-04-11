import { PacketUsageDirection, PacketUsageEntryType, Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { derivePacketUsageBalance, isLedgerAllocationEligible } from "./rnd-ledger";

describe("rnd-ledger", () => {
  it("derives balances from immutable ledger entries", () => {
    const balance = derivePacketUsageBalance(
      [
        { entryType: PacketUsageEntryType.ALLOCATE, direction: PacketUsageDirection.OUT, quantity: new Prisma.Decimal(20), useType: "TESTING" },
        { entryType: PacketUsageEntryType.CONSUME, direction: PacketUsageDirection.OUT, quantity: new Prisma.Decimal(12), useType: "TESTING" },
        { entryType: PacketUsageEntryType.RELEASE, direction: PacketUsageDirection.IN, quantity: new Prisma.Decimal(8), useType: "TESTING" },
        { entryType: PacketUsageEntryType.RECLASSIFY, direction: PacketUsageDirection.OUT, quantity: new Prisma.Decimal(5), useType: "RETAIN" },
      ],
      100,
    );

    expect(balance.available).toBe(83);
    expect(balance.reserved).toBe(0);
    expect(balance.consumed).toBe(12);
    expect(balance.retained).toBe(5);
  });

  it("blocks allocation when requested quantity exceeds available", () => {
    const eligibility = isLedgerAllocationEligible({
      requestedQty: 11,
      requestedUnit: "KG",
      packetUnit: "KG",
      packetStatus: "AVAILABLE",
      balance: {
        available: 10,
        reserved: 0,
        consumed: 0,
        retained: 0,
        backup: 0,
        reference: 0,
        clientRetest: 0,
        additionalAnalysis: 0,
      },
    });

    expect(eligibility.ok).toBe(false);
    if (!eligibility.ok) {
      expect(eligibility.reason).toContain("Insufficient available");
    }
  });
});
