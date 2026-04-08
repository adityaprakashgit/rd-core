import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthorizationError, authorize } from "@/lib/rbac";
import { getCurrentUserFromRequest } from "@/lib/session";

function jsonError(error: string, details: string, status: number) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET(request: NextRequest, context: RouteContext<"/api/packets/[id]">) {
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
      },
    });

    if (!packet) {
      return jsonError("Not Found", "Packet could not be found.", 404);
    }

    return NextResponse.json(packet);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }

    const message = error instanceof Error ? error.message : "Failed to fetch packet.";
    return jsonError("System Error", message, 500);
  }
}
