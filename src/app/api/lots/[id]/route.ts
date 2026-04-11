import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthorizationError, authorize } from "@/lib/rbac";
import { getCurrentUserFromRequest } from "@/lib/session";

function jsonError(error: string, details: string, status: number) {
  return NextResponse.json({ error, details }, { status });
}

type LotRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: LotRouteContext) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "READ_ONLY");
    const { id } = await context.params;

    const lot = await prisma.inspectionLot.findFirst({
      where: { id, companyId: currentUser.companyId },
      select: {
        id: true,
        lotNumber: true,
        materialName: true,
        jobId: true,
        sample: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!lot) {
      return jsonError("Not Found", "Lot could not be found.", 404);
    }

    return NextResponse.json(lot);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }

    const message = error instanceof Error ? error.message : "Failed to fetch lot.";
    return jsonError("System Error", message, 500);
  }
}
