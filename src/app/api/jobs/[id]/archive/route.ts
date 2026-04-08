import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit";
import { workspaceJobSummarySelect } from "@/lib/job-workspace";
import { prisma } from "@/lib/prisma";
import { authorize, assertCompanyScope, AuthorizationError } from "@/lib/rbac";
import { getCurrentUserFromRequest } from "@/lib/session";

function jsonError(error: string, details: string, status: number) {
  return NextResponse.json({ error, details }, { status });
}

function isAuthorizationError(error: unknown): error is AuthorizationError {
  return error instanceof AuthorizationError;
}

export async function POST(request: NextRequest, context: RouteContext<"/api/jobs/[id]/archive">) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "ARCHIVE_JOB");

    const { id } = await context.params;

    const existing = await prisma.inspectionJob.findUnique({
      where: { id },
      select: {
        id: true,
        companyId: true,
        status: true,
      },
    });

    if (!existing) {
      return jsonError("Not Found", "Job not found.", 404);
    }

    assertCompanyScope(currentUser.companyId, existing.companyId);

    if (existing.status === "ARCHIVED") {
      return jsonError("Conflict Action", "Job is already archived.", 409);
    }

    const archived = await prisma.$transaction(async (tx) => {
      const updated = await tx.inspectionJob.update({
        where: { id: existing.id },
        data: {
          status: "ARCHIVED",
        },
        select: workspaceJobSummarySelect,
      });

      await recordAuditLog(tx, {
        jobId: existing.id,
        userId: currentUser.id,
        entity: "JOB",
        action: "JOB_ARCHIVED",
        from: existing.status,
        to: "ARCHIVED",
        metadata: {
          archivedById: currentUser.id,
        },
      });

      return updated;
    });

    return NextResponse.json(archived);
  } catch (error: unknown) {
    if (isAuthorizationError(error)) {
      return jsonError("Forbidden", error.message, 403);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return jsonError("Database Error", error.message, 500);
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonError("System Error", message, 500);
  }
}
