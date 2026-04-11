import { NextRequest, NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { AuthorizationError, authorize } from "@/lib/rbac";
import { canMutateRndJob } from "@/lib/rnd-workflow";
import { getCurrentUserFromRequest } from "@/lib/session";

function jsonError(error: string, details: string, status: number) {
  return NextResponse.json({ error, details }, { status });
}

async function getScopedRndJob(id: string, companyId: string) {
  return prisma.rndJob.findFirst({
    where: { id, companyId },
    select: {
      id: true,
      parentJobId: true,
      assignedToId: true,
      approverUserId: true,
    },
  });
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) return jsonError("Unauthorized", "Current user could not be resolved.", 401);

    authorize(currentUser, "READ_ONLY");

    const { id } = await context.params;
    const rndJob = await getScopedRndJob(id, currentUser.companyId);
    if (!rndJob) return jsonError("Not Found", "R&D job was not found.", 404);

    const attachments = await prisma.rndJobAttachment.findMany({
      where: { rndJobId: rndJob.id },
      orderBy: { createdAt: "desc" },
      include: {
        uploadedBy: {
          select: {
            id: true,
            email: true,
            role: true,
            profile: { select: { displayName: true } },
          },
        },
      },
    });

    return NextResponse.json(attachments);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) return jsonError("Forbidden", error.message, 403);
    const message = error instanceof Error ? error.message : "Failed to fetch attachments.";
    return jsonError("System Error", message, 500);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) return jsonError("Unauthorized", "Current user could not be resolved.", 401);

    authorize(currentUser, "MUTATE_RND");

    const { id } = await context.params;
    const rndJob = await getScopedRndJob(id, currentUser.companyId);
    if (!rndJob) return jsonError("Not Found", "R&D job was not found.", 404);

    const allowed = canMutateRndJob({
      role: currentUser.role,
      assignedToId: rndJob.assignedToId,
      approverUserId: rndJob.approverUserId,
      currentUserId: currentUser.id,
      mode: "testing",
    });
    if (!allowed) return jsonError("Forbidden", "Only assigned user or admin can upload attachments.", 403);

    const body = await request.json();
    const fileName = typeof body?.fileName === "string" ? body.fileName.trim() : "";
    const fileUrl = typeof body?.fileUrl === "string" ? body.fileUrl.trim() : "";

    if (!fileName || !fileUrl) return jsonError("Validation Error", "fileName and fileUrl are required.", 400);

    const created = await prisma.$transaction(async (tx) => {
      const attachment = await tx.rndJobAttachment.create({
        data: {
          rndJobId: rndJob.id,
          fileName,
          fileUrl,
          mimeType: typeof body?.mimeType === "string" ? body.mimeType.trim() || null : null,
          fileSizeBytes: Number.isFinite(Number(body?.fileSizeBytes)) ? Number(body.fileSizeBytes) : null,
          notes: typeof body?.notes === "string" ? body.notes.trim() || null : null,
          uploadedById: currentUser.id,
        },
      });

      await recordAuditLog(tx, {
        jobId: rndJob.parentJobId,
        userId: currentUser.id,
        entity: "RND_JOB",
        action: "RND_ATTACHMENT_ADDED",
        metadata: { rndJobId: rndJob.id, attachmentId: attachment.id, fileName },
      });

      return attachment;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) return jsonError("Forbidden", error.message, 403);
    const message = error instanceof Error ? error.message : "Failed to add attachment.";
    return jsonError("System Error", message, 500);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) return jsonError("Unauthorized", "Current user could not be resolved.", 401);

    authorize(currentUser, "MUTATE_RND");

    const { id } = await context.params;
    const rndJob = await getScopedRndJob(id, currentUser.companyId);
    if (!rndJob) return jsonError("Not Found", "R&D job was not found.", 404);

    const attachmentId = request.nextUrl.searchParams.get("attachmentId")?.trim() ?? "";
    if (!attachmentId) return jsonError("Validation Error", "attachmentId is required.", 400);

    const deleted = await prisma.rndJobAttachment.deleteMany({
      where: { id: attachmentId, rndJobId: rndJob.id },
    });

    if (!deleted.count) return jsonError("Not Found", "Attachment not found.", 404);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) return jsonError("Forbidden", error.message, 403);
    const message = error instanceof Error ? error.message : "Failed to delete attachment.";
    return jsonError("System Error", message, 500);
  }
}
