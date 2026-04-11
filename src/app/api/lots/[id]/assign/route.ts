import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { authorize, assertCompanyScope, AuthorizationError } from "@/lib/rbac";

function jsonError(message: string, details: string, status: number) {
  return NextResponse.json({ error: message, details }, { status });
}

type LotAssignRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: LotAssignRouteContext) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "ASSIGN_LOT");

    const { id } = await context.params;
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null) {
      return jsonError("Invalid payload", "Request body must be a JSON object.", 400);
    }

    const payload = body as { assignedToId?: unknown };
    if (typeof payload.assignedToId !== "string" || payload.assignedToId.trim().length === 0) {
      return jsonError("Missing required fields", "assignedToId is required.", 400);
    }

    const lot = await prisma.inspectionLot.findUnique({
      where: { id },
      select: { id: true, jobId: true, companyId: true, assignedToId: true, status: true },
    });

    if (!lot) {
      return jsonError("Not found", "Lot not found.", 404);
    }

    assertCompanyScope(currentUser.companyId, lot.companyId);

    if (lot.assignedToId === payload.assignedToId.trim()) {
      return jsonError("Duplicate assignment", "This lot is already assigned to that user.", 409);
    }

    const assignee = await prisma.user.findUnique({
      where: { id: payload.assignedToId.trim() },
      select: { id: true, companyId: true, isActive: true },
    });

    if (!assignee || !assignee.isActive) {
      return jsonError("Invalid assignee", "Assigned user does not exist or is inactive.", 400);
    }

    assertCompanyScope(currentUser.companyId, assignee.companyId);

    const updated = await prisma.$transaction(async (tx) => {
      const lotUpdate = await tx.inspectionLot.update({
        where: { id: lot.id },
        data: {
          assignedToId: assignee.id,
          assignedById: currentUser.id,
          assignedAt: new Date(),
          status: lot.status === "PENDING" || lot.status === "CREATED" ? "IN_PROGRESS" : lot.status,
        },
        select: {
          id: true,
          lotNumber: true,
          totalBags: true,
          status: true,
          assignedAt: true,
        },
      });

      await tx.auditLog.create({
        data: {
          jobId: lot.jobId,
          userId: currentUser.id,
          entity: "LOT",
          action: "ASSIGNED",
          metadata: {
            assignedToId: assignee.id,
            assignedById: currentUser.id,
          },
        },
      });

      return lotUpdate;
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return jsonError("Database error", error.message, 500);
    }

    const message = error instanceof Error ? error.message : "Failed to assign lot";
    return jsonError("Failed to assign lot", message, 500);
  }
}
