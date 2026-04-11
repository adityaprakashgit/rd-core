import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthorizationError, authorize } from "@/lib/rbac";
import { derivePacketUsageBalance } from "@/lib/rnd-ledger";
import { getCurrentUserFromRequest } from "@/lib/session";

function jsonError(error: string, details: string, status: number) {
  return NextResponse.json({ error, details }, { status });
}

type PacketRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: PacketRouteContext) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "READ_ONLY");
    const { id } = await context.params;

    const packet = await prisma.packet.findFirst({
      where: { id, companyId: currentUser.companyId },
      select: {
        id: true,
        packetCode: true,
        jobId: true,
        lotId: true,
        sampleId: true,
        packetWeight: true,
        packetQuantity: true,
        packetUnit: true,
        packetStatus: true,
        usageLedgerEntries: {
          orderBy: { createdAt: "desc" },
          take: 50,
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

    if (!packet) {
      return jsonError("Not Found", "Packet could not be found.", 404);
    }

    const seed = Number(packet.packetWeight ?? packet.packetQuantity ?? 0);
    const balance = derivePacketUsageBalance(packet.usageLedgerEntries, Number.isFinite(seed) ? seed : 0);

    return NextResponse.json({
      ...packet,
      ledgerBalance: balance,
    });
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }

    const message = error instanceof Error ? error.message : "Failed to fetch packet.";
    return jsonError("System Error", message, 500);
  }
}
