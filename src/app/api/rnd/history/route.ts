import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthorizationError, authorize } from "@/lib/rbac";
import { rndJobListSelect } from "@/lib/rnd-job-select";
import { getCurrentUserFromRequest } from "@/lib/session";

function jsonError(error: string, details: string, status: number) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) return jsonError("Unauthorized", "Current user could not be resolved.", 401);

    authorize(currentUser, "READ_ONLY");

    const rows = await prisma.rndJob.findMany({
      where: {
        companyId: currentUser.companyId,
        status: { in: ["APPROVED", "COMPLETED"] },
      },
      select: {
        ...rndJobListSelect,
        previousRndJob: {
          select: {
            id: true,
            rndJobNumber: true,
          },
        },
        nextRetestJobs: {
          select: {
            id: true,
            rndJobNumber: true,
            status: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [{ completedAt: "desc" }, { updatedAt: "desc" }],
      take: 500,
    });

    return NextResponse.json(rows);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) return jsonError("Forbidden", error.message, 403);
    const message = error instanceof Error ? error.message : "Failed to fetch R&D history.";
    return jsonError("System Error", message, 500);
  }
}
