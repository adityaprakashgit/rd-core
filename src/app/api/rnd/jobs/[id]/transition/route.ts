import { RndJobStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { generateAndLinkRndReportSnapshot, ReportGenerationError } from "@/lib/rnd-report-generation";
import { AuthorizationError, authorize } from "@/lib/rbac";
import { canMutateRndJob, canTransition } from "@/lib/rnd-workflow";
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
    const targetRaw = typeof body?.toStatus === "string" ? body.toStatus.trim().toUpperCase() : "";

    if (!Object.values(RndJobStatus).includes(targetRaw as RndJobStatus)) {
      return jsonError("Validation Error", "toStatus is invalid.", 400);
    }
    const toStatus = targetRaw as RndJobStatus;

    const rndJob = await prisma.rndJob.findFirst({
      where: { id, companyId: currentUser.companyId },
      select: {
        id: true,
        parentJobId: true,
        packetId: true,
        previousRndJobId: true,
        packetUse: true,
        status: true,
        assignedToId: true,
        approverUserId: true,
      },
    });

    if (!rndJob) return jsonError("Not Found", "R&D job was not found.", 404);

    const mode = toStatus === RndJobStatus.APPROVED || toStatus === RndJobStatus.REWORK_REQUIRED ? "review" : "testing";
    const allowed = canMutateRndJob({
      role: currentUser.role,
      assignedToId: rndJob.assignedToId,
      approverUserId: rndJob.approverUserId,
      currentUserId: currentUser.id,
      mode,
    });
    if (!allowed) return jsonError("Forbidden", "You are not allowed for this transition.", 403);

    if (!canTransition(rndJob.status, toStatus)) {
      return jsonError("Workflow Error", `Transition from ${rndJob.status} to ${toStatus} is not allowed.`, 422);
    }

    const enforceLedgerPrereqs = Boolean(rndJob.previousRndJobId);

    if (enforceLedgerPrereqs && (toStatus === RndJobStatus.IN_TESTING || toStatus === RndJobStatus.AWAITING_REVIEW)) {
      if (!rndJob.packetUse) {
        return jsonError("Workflow Error", "Packet use is required before testing transitions.", 422);
      }
      const [allocates, releases] = await Promise.all([
        prisma.packetUsageLedger.aggregate({
          where: {
            companyId: currentUser.companyId,
            packetId: rndJob.packetId,
            rndJobId: rndJob.id,
            entryType: "ALLOCATE",
          },
          _sum: { quantity: true },
        }),
        prisma.packetUsageLedger.aggregate({
          where: {
            companyId: currentUser.companyId,
            packetId: rndJob.packetId,
            rndJobId: rndJob.id,
            entryType: "RELEASE",
          },
          _sum: { quantity: true },
        }),
      ]);

      const allocatedQty = Number(allocates._sum.quantity ?? 0);
      const releasedQty = Number(releases._sum.quantity ?? 0);
      if (allocatedQty - releasedQty <= 0) {
        return jsonError("Workflow Error", "Allocate packet quantity before testing.", 422);
      }
    }

    if (enforceLedgerPrereqs && toStatus === RndJobStatus.AWAITING_REVIEW) {
      const [consumed, readingsCount] = await Promise.all([
        prisma.packetUsageLedger.aggregate({
          where: {
            companyId: currentUser.companyId,
            packetId: rndJob.packetId,
            rndJobId: rndJob.id,
            entryType: "CONSUME",
          },
          _sum: { quantity: true },
        }),
        prisma.rndJobReading.count({
          where: { rndJobId: rndJob.id },
        }),
      ]);

      const consumedQty = Number(consumed._sum.quantity ?? 0);
      if (consumedQty <= 0) {
        return jsonError("Workflow Error", "Consume packet quantity before submitting results.", 422);
      }
      if (readingsCount <= 0) {
        return jsonError("Workflow Error", "At least one reading is required before review.", 422);
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.rndJob.update({
        where: { id: rndJob.id },
        data: {
          status: toStatus,
          ...(toStatus === RndJobStatus.IN_TESTING ? { testingStartedAt: new Date() } : {}),
          ...(toStatus === RndJobStatus.AWAITING_REVIEW ? { resultsSubmittedAt: new Date() } : {}),
          ...(toStatus === RndJobStatus.APPROVED ? { reviewedAt: new Date() } : {}),
          ...(toStatus === RndJobStatus.COMPLETED ? { completedAt: new Date() } : {}),
        },
      });

      await recordAuditLog(tx, {
        jobId: rndJob.parentJobId,
        userId: currentUser.id,
        entity: "RND_JOB",
        action: "RND_STATUS_CHANGED",
        from: rndJob.status,
        to: toStatus,
        metadata: {
          rndJobId: rndJob.id,
        },
      });

      if (toStatus === RndJobStatus.COMPLETED) {
        await generateAndLinkRndReportSnapshot(tx, {
          companyId: currentUser.companyId,
          rndJobId: rndJob.id,
        });
      }

      return next;
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) return jsonError("Forbidden", error.message, 403);
    if (error instanceof ReportGenerationError) return jsonError("Workflow Error", error.message, error.status);
    const message = error instanceof Error ? error.message : "Failed to transition R&D job.";
    return jsonError("System Error", message, 500);
  }
}
