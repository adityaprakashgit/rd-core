import { RndJobStatus, RndReviewAction } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { AuthorizationError, authorize } from "@/lib/rbac";
import { canMutateRndJob, reviewActionToStatus } from "@/lib/rnd-workflow";
import { getCurrentUserFromRequest } from "@/lib/session";

function jsonError(error: string, details: string, status: number) {
  return NextResponse.json({ error, details }, { status });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) return jsonError("Unauthorized", "Current user could not be resolved.", 401);

    authorize(currentUser, "MUTATE_RND");

    const { id } = await context.params;
    const body = await request.json();

    const actionRaw = typeof body?.action === "string" ? body.action.trim().toUpperCase() : "";
    if (!Object.values(RndReviewAction).includes(actionRaw as RndReviewAction)) {
      return jsonError("Validation Error", "action must be APPROVE, REJECT, or REWORK.", 400);
    }
    const action = actionRaw as RndReviewAction;

    const notes = typeof body?.notes === "string" ? body.notes.trim() : "";
    if ((action === RndReviewAction.REJECT || action === RndReviewAction.REWORK) && !notes) {
      return jsonError("Validation Error", "notes are required for reject/rework.", 400);
    }

    const rndJob = await prisma.rndJob.findFirst({
      where: { id, companyId: currentUser.companyId },
      select: {
        id: true,
        parentJobId: true,
        sampleId: true,
        status: true,
        assignedToId: true,
        approverUserId: true,
      },
    });

    if (!rndJob) return jsonError("Not Found", "R&D job was not found.", 404);
    if (rndJob.status !== RndJobStatus.AWAITING_REVIEW) {
      return jsonError("Workflow Error", "Review is allowed only in Awaiting Review state.", 422);
    }

    const allowed = canMutateRndJob({
      role: currentUser.role,
      assignedToId: rndJob.assignedToId,
      approverUserId: rndJob.approverUserId,
      currentUserId: currentUser.id,
      mode: "review",
    });
    if (!allowed) {
      return jsonError("Forbidden", "Only designated approver or admin can review.", 403);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const review = await tx.rndJobReview.create({
        data: {
          rndJobId: rndJob.id,
          action,
          notes: notes || null,
          reviewedById: currentUser.id,
        },
      });

      const nextStatus = reviewActionToStatus(action);
      const next = await tx.rndJob.update({
        where: { id: rndJob.id },
        data: {
          status: nextStatus,
          reviewedAt: new Date(),
          ...(nextStatus === RndJobStatus.APPROVED ? { resultPrecedence: "ACTIVE" } : {}),
          ...(nextStatus === RndJobStatus.APPROVED ? { completedAt: null } : {}),
        },
      });

      if (nextStatus === RndJobStatus.APPROVED) {
        await tx.rndJob.updateMany({
          where: {
            companyId: currentUser.companyId,
            parentJobId: rndJob.parentJobId,
            sampleId: rndJob.sampleId,
            id: { not: rndJob.id },
            status: { in: [RndJobStatus.APPROVED, RndJobStatus.COMPLETED] },
          },
          data: {
            resultPrecedence: "SUPERSEDED",
          },
        });

        await tx.rndReportVersion.updateMany({
          where: {
            companyId: currentUser.companyId,
            parentJobId: rndJob.parentJobId,
            sampleId: rndJob.sampleId,
            precedence: "ACTIVE",
          },
          data: {
            precedence: "SUPERSEDED",
          },
        });
      }

      await recordAuditLog(tx, {
        jobId: rndJob.parentJobId,
        userId: currentUser.id,
        entity: "RND_JOB",
        action: "RND_REVIEW_DECISION",
        from: rndJob.status,
        to: next.status,
        notes: notes || null,
        metadata: {
          rndJobId: rndJob.id,
          reviewId: review.id,
          reviewAction: action,
        },
      });

      return next;
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) return jsonError("Forbidden", error.message, 403);
    const message = error instanceof Error ? error.message : "Failed to review R&D job.";
    return jsonError("System Error", message, 500);
  }
}
