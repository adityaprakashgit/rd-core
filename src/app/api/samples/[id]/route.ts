import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthorizationError, authorize } from "@/lib/rbac";
import { getCurrentUserFromRequest } from "@/lib/session";

function jsonError(error: string, details: string, status: number) {
  return NextResponse.json({ error, details }, { status });
}

type SampleRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: SampleRouteContext) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "READ_ONLY");
    const { id } = await context.params;

    const sample = await prisma.sample.findFirst({
      where: { id, companyId: currentUser.companyId },
      select: {
        id: true,
        sampleCode: true,
        jobId: true,
        lotId: true,
      },
    });

    if (!sample) {
      return jsonError("Not Found", "Sample could not be found.", 404);
    }

    return NextResponse.json(sample);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }

    const message = error instanceof Error ? error.message : "Failed to fetch sample.";
    return jsonError("System Error", message, 500);
  }
}
