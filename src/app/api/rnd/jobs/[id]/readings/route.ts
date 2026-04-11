import { RndJobStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { AuthorizationError, authorize } from "@/lib/rbac";
import { canMutateRndJob } from "@/lib/rnd-workflow";
import { getCurrentUserFromRequest } from "@/lib/session";

function jsonError(error: string, details: string, status: number) {
  return NextResponse.json({ error, details }, { status });
}

function parseValue(value: unknown) {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

async function getScopedRndJob(id: string, companyId: string) {
  return prisma.rndJob.findFirst({
    where: { id, companyId },
    select: {
      id: true,
      parentJobId: true,
      status: true,
      assignedToId: true,
      approverUserId: true,
    },
  });
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
    if (!allowed) return jsonError("Forbidden", "Only assigned user or admin can enter readings.", 403);

    const body = await request.json();
    const parameter = typeof body?.parameter === "string" ? body.parameter.trim() : "";
    const value = parseValue(body?.value);
    const unit = typeof body?.unit === "string" ? body.unit.trim() : null;
    const remarks = typeof body?.remarks === "string" ? body.remarks.trim() : null;

    if (!parameter || value === null) {
      return jsonError("Validation Error", "parameter and numeric value are required.", 400);
    }

    const reading = await prisma.$transaction(async (tx) => {
      const created = await tx.rndJobReading.create({
        data: {
          rndJobId: rndJob.id,
          parameter,
          value,
          unit,
          remarks,
        },
      });

      if (rndJob.status === RndJobStatus.READY_FOR_TESTING) {
        await tx.rndJob.update({
          where: { id: rndJob.id },
          data: {
            status: RndJobStatus.IN_TESTING,
            testingStartedAt: new Date(),
          },
        });
      }

      await recordAuditLog(tx, {
        jobId: rndJob.parentJobId,
        userId: currentUser.id,
        entity: "RND_JOB",
        action: "RND_READING_ADDED",
        metadata: {
          rndJobId: rndJob.id,
          readingId: created.id,
          parameter,
        },
      });

      return created;
    });

    return NextResponse.json(reading, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) return jsonError("Forbidden", error.message, 403);
    const message = error instanceof Error ? error.message : "Failed to add reading.";
    return jsonError("System Error", message, 500);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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
    if (!allowed) return jsonError("Forbidden", "Only assigned user or admin can edit readings.", 403);

    const body = await request.json();
    const readingId = typeof body?.readingId === "string" ? body.readingId.trim() : "";
    if (!readingId) return jsonError("Validation Error", "readingId is required.", 400);

    const parsedValue = body?.value !== undefined ? parseValue(body.value) : undefined;
    if (body?.value !== undefined && parsedValue === null) return jsonError("Validation Error", "value must be numeric.", 400);
    const numericValue = parsedValue === undefined ? undefined : (parsedValue as number);

    const updated = await prisma.rndJobReading.updateMany({
      where: { id: readingId, rndJobId: rndJob.id },
      data: {
        ...(body?.parameter !== undefined ? { parameter: typeof body.parameter === "string" ? body.parameter.trim() : "" } : {}),
        ...(numericValue !== undefined ? { value: numericValue } : {}),
        ...(body?.unit !== undefined ? { unit: typeof body.unit === "string" ? body.unit.trim() || null : null } : {}),
        ...(body?.remarks !== undefined ? { remarks: typeof body.remarks === "string" ? body.remarks.trim() || null : null } : {}),
      },
    });

    if (!updated.count) return jsonError("Not Found", "Reading not found.", 404);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) return jsonError("Forbidden", error.message, 403);
    const message = error instanceof Error ? error.message : "Failed to update reading.";
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

    const readingId = request.nextUrl.searchParams.get("readingId")?.trim() ?? "";
    if (!readingId) return jsonError("Validation Error", "readingId is required.", 400);

    const deleted = await prisma.rndJobReading.deleteMany({
      where: { id: readingId, rndJobId: rndJob.id },
    });

    if (!deleted.count) return jsonError("Not Found", "Reading not found.", 404);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) return jsonError("Forbidden", error.message, 403);
    const message = error instanceof Error ? error.message : "Failed to delete reading.";
    return jsonError("System Error", message, 500);
  }
}
