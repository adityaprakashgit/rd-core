import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { authorize, assertCompanyScope, AuthorizationError } from "@/lib/rbac";
import { workspaceJobSummarySelect } from "@/lib/job-workspace";

function jsonError(message: string, details: string, status: number) {
  return NextResponse.json({ error: message, details }, { status });
}

function isAuthorizationError(error: unknown): error is AuthorizationError {
  return error instanceof AuthorizationError;
}

type JobAssignRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: JobAssignRouteContext) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "ASSIGN_JOB");

    const { id } = await context.params;
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null) {
      return jsonError("Invalid payload", "Request body must be a JSON object.", 400);
    }

    const payload = body as { assignedToId?: unknown };
    if (typeof payload.assignedToId !== "string" || payload.assignedToId.trim().length === 0) {
      return jsonError("Missing required fields", "assignedToId is required.", 400);
    }

    const job = await prisma.inspectionJob.findUnique({
      where: { id },
      select: {
        id: true,
        companyId: true,
        assignedToId: true,
        status: true,
      },
    });

    if (!job) {
      return jsonError("Not found", "Job not found.", 404);
    }

    assertCompanyScope(currentUser.companyId, job.companyId);

    if (job.assignedToId === payload.assignedToId.trim()) {
      return jsonError("Duplicate assignment", "This job is already assigned to that user.", 409);
    }

    const assignee = await prisma.user.findUnique({
      where: { id: payload.assignedToId.trim() },
      select: {
        id: true,
        companyId: true,
        isActive: true,
      },
    });

    if (!assignee || !assignee.isActive) {
      return jsonError("Invalid assignee", "Assigned user does not exist or is inactive.", 400);
    }

    assertCompanyScope(currentUser.companyId, assignee.companyId);

    const updated = await prisma.$transaction(async (tx) => {
      const jobUpdate = await tx.inspectionJob.update({
        where: { id: job.id },
        data: {
          assignedToId: assignee.id,
          assignedById: currentUser.id,
          assignedAt: new Date(),
          status: job.status === "PENDING" || job.status === "CREATED" ? "IN_PROGRESS" : job.status,
        },
        select: workspaceJobSummarySelect,
      });

      await tx.auditLog.create({
        data: {
          jobId: job.id,
          userId: currentUser.id,
          entity: "JOB",
          action: "ASSIGNED",
          metadata: {
            assignedToId: assignee.id,
            assignedById: currentUser.id,
          },
        },
      });

      return jobUpdate;
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    if (isAuthorizationError(error)) {
      return jsonError("Forbidden", error.message, 403);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return jsonError("Database error", error.message, 500);
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonError("Failed to assign job", message, 500);
  }
}
