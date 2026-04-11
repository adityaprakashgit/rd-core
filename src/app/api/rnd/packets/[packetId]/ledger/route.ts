import { PacketUsageDirection, PacketUsageEntryType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { AuthorizationError, authorize } from "@/lib/rbac";
import {
  derivePacketUsageBalance,
  isLedgerAllocationEligible,
  ledgerDirectionForEntryType,
  normalizeLedgerQuantity,
  normalizePacketUnit,
} from "@/lib/rnd-ledger";
import { normalizePacketUse } from "@/lib/rnd-workflow";
import { getCurrentUserFromRequest } from "@/lib/session";

function jsonError(error: string, details: string, status: number) {
  return NextResponse.json({ error, details }, { status });
}

function normalizeEntryType(value: unknown): PacketUsageEntryType | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (!Object.values(PacketUsageEntryType).includes(normalized as PacketUsageEntryType)) return null;
  return normalized as PacketUsageEntryType;
}

function normalizeDirection(value: unknown): PacketUsageDirection | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (!Object.values(PacketUsageDirection).includes(normalized as PacketUsageDirection)) return null;
  return normalized as PacketUsageDirection;
}

export async function GET(request: NextRequest, context: { params: Promise<{ packetId: string }> }) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) return jsonError("Unauthorized", "Current user could not be resolved.", 401);

    authorize(currentUser, "READ_ONLY");
    const { packetId } = await context.params;

    const packet = await prisma.packet.findFirst({
      where: { id: packetId, companyId: currentUser.companyId },
      select: {
        id: true,
        packetCode: true,
        packetWeight: true,
        packetQuantity: true,
        packetUnit: true,
        packetStatus: true,
        usageLedgerEntries: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            rndJobId: true,
            entryType: true,
            useType: true,
            quantity: true,
            unit: true,
            direction: true,
            notes: true,
            createdById: true,
            createdAt: true,
          },
        },
      },
    });

    if (!packet) return jsonError("Not Found", "Packet was not found.", 404);

    const seed = Number(packet.packetWeight ?? packet.packetQuantity ?? 0);
    const balance = derivePacketUsageBalance(packet.usageLedgerEntries, Number.isFinite(seed) ? seed : 0);

    return NextResponse.json({
      packet: {
        id: packet.id,
        packetCode: packet.packetCode,
        packetUnit: packet.packetUnit,
        packetStatus: packet.packetStatus,
      },
      balance,
      entries: packet.usageLedgerEntries,
    });
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) return jsonError("Forbidden", error.message, 403);
    const message = error instanceof Error ? error.message : "Failed to fetch packet ledger.";
    return jsonError("System Error", message, 500);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ packetId: string }> }) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) return jsonError("Unauthorized", "Current user could not be resolved.", 401);

    authorize(currentUser, "MUTATE_RND");
    const { packetId } = await context.params;
    const body = await request.json();

    const entryType = normalizeEntryType(body?.entryType);
    if (!entryType) return jsonError("Validation Error", "entryType is invalid.", 400);

    const useType = body?.useType !== undefined ? normalizePacketUse(body.useType) : null;
    if (body?.useType !== undefined && !useType) {
      return jsonError("Validation Error", "useType is invalid.", 400);
    }

    const quantity = normalizeLedgerQuantity(body?.quantity);
    if (!quantity) return jsonError("Validation Error", "quantity must be greater than zero.", 400);

    const rndJobId = typeof body?.rndJobId === "string" ? body.rndJobId.trim() : null;
    const notes = typeof body?.notes === "string" ? body.notes.trim() || null : null;

    const created = await prisma.$transaction(async (tx) => {
      const packet = await tx.packet.findFirst({
        where: { id: packetId, companyId: currentUser.companyId },
        select: {
          id: true,
          jobId: true,
          packetStatus: true,
          packetUnit: true,
          packetWeight: true,
          packetQuantity: true,
          usageLedgerEntries: {
            orderBy: { createdAt: "asc" },
            select: {
              entryType: true,
              useType: true,
              quantity: true,
              direction: true,
            },
          },
        },
      });
      if (!packet) throw new Error("PACKET_NOT_FOUND");

      if (rndJobId) {
        const scopedRndJob = await tx.rndJob.findFirst({
          where: { id: rndJobId, companyId: currentUser.companyId },
          select: { id: true },
        });
        if (!scopedRndJob) throw new Error("RND_JOB_NOT_FOUND");
      }

      const packetUnit = normalizePacketUnit(packet.packetUnit);
      const unit = normalizePacketUnit(body?.unit ?? packet.packetUnit);
      if (!unit || (packetUnit && packetUnit !== unit)) {
        throw new Error("UNIT_MISMATCH");
      }

      const seed = Number(packet.packetWeight ?? packet.packetQuantity ?? 0);
      const balance = derivePacketUsageBalance(packet.usageLedgerEntries, Number.isFinite(seed) ? seed : 0);

      if (entryType === PacketUsageEntryType.ALLOCATE) {
        const eligibility = isLedgerAllocationEligible({
          requestedQty: quantity,
          requestedUnit: unit,
          packetUnit: packet.packetUnit,
          packetStatus: packet.packetStatus,
          balance,
        });
        if (!eligibility.ok) throw new Error(`LEDGER_BLOCK_${eligibility.reason}`);
      }
      if (entryType === PacketUsageEntryType.CONSUME && balance.reserved < quantity) {
        throw new Error("INSUFFICIENT_RESERVED");
      }
      if (entryType === PacketUsageEntryType.RELEASE && balance.reserved < quantity) {
        throw new Error("INSUFFICIENT_RESERVED");
      }
      if (entryType === PacketUsageEntryType.RECLASSIFY && balance.available < quantity) {
        throw new Error("INSUFFICIENT_AVAILABLE");
      }

      const direction =
        entryType === PacketUsageEntryType.ADJUST
          ? normalizeDirection(body?.direction) ?? PacketUsageDirection.OUT
          : ledgerDirectionForEntryType(entryType);

      if (entryType === PacketUsageEntryType.ADJUST && direction === PacketUsageDirection.OUT && balance.available < quantity) {
        throw new Error("INSUFFICIENT_AVAILABLE");
      }

      const entry = await tx.packetUsageLedger.create({
        data: {
          companyId: currentUser.companyId,
          packetId: packet.id,
          rndJobId,
          entryType,
          useType,
          quantity,
          unit,
          direction,
          notes,
          createdById: currentUser.id,
        },
      });

      await recordAuditLog(tx, {
        jobId: packet.jobId,
        userId: currentUser.id,
        entity: "PACKET",
        action: "PACKET_USAGE_LEDGER_ENTRY_CREATED",
        metadata: {
          packetId: packet.id,
          packetUsageLedgerId: entry.id,
          entryType,
          useType,
          quantity,
          unit,
          direction,
        },
      });

      return entry;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) return jsonError("Forbidden", error.message, 403);
    if (error instanceof Error && error.message === "PACKET_NOT_FOUND") return jsonError("Not Found", "Packet was not found.", 404);
    if (error instanceof Error && error.message === "RND_JOB_NOT_FOUND") return jsonError("Not Found", "R&D job was not found.", 404);
    if (error instanceof Error && error.message === "UNIT_MISMATCH") {
      return jsonError("Validation Error", "Ledger unit must match packet unit.", 422);
    }
    if (error instanceof Error && error.message === "INSUFFICIENT_RESERVED") {
      return jsonError("Workflow Error", "Insufficient reserved quantity for this action.", 422);
    }
    if (error instanceof Error && error.message === "INSUFFICIENT_AVAILABLE") {
      return jsonError("Workflow Error", "Insufficient available quantity for this action.", 422);
    }
    if (error instanceof Error && error.message.startsWith("LEDGER_BLOCK_")) {
      return jsonError("Workflow Error", error.message.replace("LEDGER_BLOCK_", ""), 422);
    }
    const message = error instanceof Error ? error.message : "Failed to create ledger entry.";
    return jsonError("System Error", message, 500);
  }
}
