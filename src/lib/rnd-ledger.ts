import { PacketUsageEntryType, PacketUsageDirection, type PacketUsageLedger } from "@prisma/client";

import { normalizePacketUse } from "@/lib/rnd-workflow";

export type PacketUsageBalance = {
  available: number;
  reserved: number;
  consumed: number;
  retained: number;
  backup: number;
  reference: number;
  clientRetest: number;
  additionalAnalysis: number;
};

export function normalizeLedgerQuantity(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return numeric;
}

function clampNonNegative(value: number) {
  return value < 0 ? 0 : value;
}

export function derivePacketUsageBalance(
  entries: Array<Pick<PacketUsageLedger, "entryType" | "direction" | "quantity" | "useType">>,
  seedAvailable: number,
): PacketUsageBalance {
  const balance: PacketUsageBalance = {
    available: clampNonNegative(seedAvailable),
    reserved: 0,
    consumed: 0,
    retained: 0,
    backup: 0,
    reference: 0,
    clientRetest: 0,
    additionalAnalysis: 0,
  };

  for (const entry of entries) {
    const qty = Number(entry.quantity);
    if (!Number.isFinite(qty) || qty <= 0) continue;

    switch (entry.entryType) {
      case PacketUsageEntryType.ALLOCATE:
        balance.available = clampNonNegative(balance.available - qty);
        balance.reserved += qty;
        break;
      case PacketUsageEntryType.CONSUME: {
        const moved = Math.min(balance.reserved, qty);
        balance.reserved = clampNonNegative(balance.reserved - moved);
        balance.consumed += qty;
        const useType = normalizePacketUse(entry.useType);
        if (useType === "RETAIN") balance.retained += qty;
        if (useType === "BACKUP") balance.backup += qty;
        if (useType === "REFERENCE") balance.reference += qty;
        if (useType === "CLIENT_RETEST") balance.clientRetest += qty;
        if (useType === "ADDITIONAL_ANALYSIS") balance.additionalAnalysis += qty;
        break;
      }
      case PacketUsageEntryType.RELEASE:
        balance.reserved = clampNonNegative(balance.reserved - qty);
        balance.available += qty;
        break;
      case PacketUsageEntryType.RECLASSIFY: {
        balance.available = clampNonNegative(balance.available - qty);
        const useType = normalizePacketUse(entry.useType);
        if (useType === "RETAIN") balance.retained += qty;
        if (useType === "BACKUP") balance.backup += qty;
        if (useType === "REFERENCE") balance.reference += qty;
        if (useType === "CLIENT_RETEST") balance.clientRetest += qty;
        if (useType === "ADDITIONAL_ANALYSIS") balance.additionalAnalysis += qty;
        break;
      }
      case PacketUsageEntryType.ADJUST:
        if (entry.direction === PacketUsageDirection.IN) {
          balance.available += qty;
        } else {
          balance.available = clampNonNegative(balance.available - qty);
        }
        break;
      default:
        break;
    }
  }

  return balance;
}

export function defaultPacketUsageBalance(seedAvailable = 0): PacketUsageBalance {
  return {
    available: clampNonNegative(seedAvailable),
    reserved: 0,
    consumed: 0,
    retained: 0,
    backup: 0,
    reference: 0,
    clientRetest: 0,
    additionalAnalysis: 0,
  };
}

export function normalizePacketUnit(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toUpperCase();
}

export function isLedgerAllocationEligible(input: {
  requestedQty: number;
  requestedUnit: string;
  packetUnit: string | null | undefined;
  packetStatus: string | null | undefined;
  balance: PacketUsageBalance;
}) {
  if (!Number.isFinite(input.requestedQty) || input.requestedQty <= 0) {
    return { ok: false, reason: "Requested quantity must be greater than zero." };
  }

  if (!input.packetUnit || input.packetUnit.trim().toUpperCase() !== input.requestedUnit.trim().toUpperCase()) {
    return { ok: false, reason: "Requested unit must match packet unit." };
  }

  const normalizedStatus = (input.packetStatus ?? "").trim().toUpperCase();
  if (!["AVAILABLE", "ALLOCATED", "RESERVED"].includes(normalizedStatus)) {
    return { ok: false, reason: "Packet status is not eligible for allocation." };
  }

  if (input.balance.available < input.requestedQty) {
    return { ok: false, reason: "Insufficient available packet quantity." };
  }

  return { ok: true as const };
}

export function ledgerDirectionForEntryType(entryType: PacketUsageEntryType): PacketUsageDirection {
  if (entryType === PacketUsageEntryType.RELEASE || entryType === PacketUsageEntryType.ADJUST) {
    return PacketUsageDirection.IN;
  }
  return PacketUsageDirection.OUT;
}
