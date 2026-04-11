import { RndJobStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { AuthorizationError, authorize } from "@/lib/rbac";
import { canMutateRndJob, normalizePacketUse, normalizePriority } from "@/lib/rnd-workflow";
import { getCurrentUserFromRequest } from "@/lib/session";

function jsonError(error: string, details: string, status: number) {
  return NextResponse.json({ error, details }, { status });
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) return jsonError("Unauthorized", "Current user could not be resolved.", 401);

    authorize(currentUser, "MUTATE_RND");

    const { id } = await context.params;
    const body = await request.json();

    const rndJob = await prisma.rndJob.findFirst({
      where: { id, companyId: currentUser.companyId },
    });
    if (!rndJob) return jsonError("Not Found", "R&D job was not found.", 404);

    const allowed = canMutateRndJob({
      role: currentUser.role,
      assignedToId: rndJob.assignedToId,
      approverUserId: rndJob.approverUserId,
      currentUserId: currentUser.id,
      mode: "setup",
    });
    if (!allowed) return jsonError("Forbidden", "Only assigned user or admin can update setup.", 403);

    const packetUse = body?.packetUse !== undefined ? normalizePacketUse(body.packetUse) : undefined;
    if (body?.packetUse !== undefined && !packetUse) {
      return jsonError("Validation Error", "Invalid packet use.", 400);
    }

    const deadline = body?.deadline !== undefined ? parseDate(body.deadline) : undefined;
    if (body?.deadline !== undefined && body?.deadline && !deadline) {
      return jsonError("Validation Error", "Invalid deadline.", 400);
    }

    const assignedToId = typeof body?.assignedToId === "string" ? body.assignedToId.trim() : undefined;
    const approverUserId = typeof body?.approverUserId === "string" ? body.approverUserId.trim() : undefined;

    if (assignedToId) {
      const assignee = await prisma.user.findFirst({
        where: { id: assignedToId, companyId: currentUser.companyId, role: "RND", isActive: true },
        select: { id: true },
      });
      if (!assignee) return jsonError("Validation Error", "Assigned user must be an active R&D user.", 400);
    }

    if (approverUserId) {
      const approver = await prisma.user.findFirst({
        where: { id: approverUserId, companyId: currentUser.companyId, isActive: true, role: { in: ["RND", "ADMIN"] } },
        select: { id: true },
      });
      if (!approver) return jsonError("Validation Error", "Approver must be an active R&D/Admin user.", 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.rndJob.update({
        where: { id: rndJob.id },
        data: {
          ...(packetUse !== undefined ? { packetUse } : {}),
          ...(body?.testType !== undefined ? { testType: typeof body.testType === "string" ? body.testType.trim() : null } : {}),
          ...(body?.testMethod !== undefined ? { testMethod: typeof body.testMethod === "string" ? body.testMethod.trim() : null } : {}),
          ...(body?.priority !== undefined ? { priority: normalizePriority(body.priority) } : {}),
          ...(deadline !== undefined ? { deadline } : {}),
          ...(assignedToId !== undefined ? { assignedToId: assignedToId || null } : {}),
          ...(approverUserId !== undefined ? { approverUserId: approverUserId || null } : {}),
          ...(body?.remarks !== undefined ? { remarks: typeof body.remarks === "string" ? body.remarks.trim() : null } : {}),
          ...(rndJob.status === RndJobStatus.CREATED ? { status: RndJobStatus.READY_FOR_TEST_SETUP } : {}),
        },
      });

      await recordAuditLog(tx, {
        jobId: rndJob.parentJobId,
        userId: currentUser.id,
        entity: "RND_JOB",
        action: "RND_SETUP_UPDATED",
        metadata: {
          rndJobId: rndJob.id,
          status: next.status,
        },
      });

      return next;
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) return jsonError("Forbidden", error.message, 403);
    const message = error instanceof Error ? error.message : "Failed to update setup.";
    return jsonError("System Error", message, 500);
  }
}
