import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { authorize, assertCompanyScope, AuthorizationError } from "@/lib/rbac";
import { generateUniqueSealNumber, isValidSealNumber } from "@/lib/traceability";

function jsonError(error: string, details: string, status: number) {
  return NextResponse.json({ error, details }, { status });
}

async function createAuditSafe(tx: Prisma.TransactionClient, input: {
  jobId: string;
  userId: string;
  action: "SEAL_GENERATED" | "SEAL_ASSIGNED";
  sealNumber: string;
  sealAuto: boolean;
}) {
  try {
    await tx.auditLog.create({
      data: {
        jobId: input.jobId,
        userId: input.userId,
        entity: "LOT",
        action: input.action,
        metadata: {
          sealNumber: input.sealNumber,
          sealAuto: input.sealAuto,
        },
      },
    });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      return;
    }
    throw error;
  }
}

export async function POST(request: NextRequest, context: RouteContext<"/api/lots/[id]/seal">) {
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

    const payload = body as {
      sealNumber?: unknown;
      auto?: unknown;
    };

    const lot = await prisma.inspectionLot.findUnique({
      where: { id },
      select: {
        id: true,
        jobId: true,
        companyId: true,
        lotNumber: true,
        sealNumber: true,
      },
    });

    if (!lot) {
      return jsonError("Not found", "Lot not found.", 404);
    }

    assertCompanyScope(currentUser.companyId, lot.companyId);

    if (lot.sealNumber) {
      return jsonError("Conflict", "This seal number is immutable once assigned.", 409);
    }

    const useAuto = payload.auto === true;
    const manualSeal = typeof payload.sealNumber === "string" ? payload.sealNumber.trim() : "";
    const sealNumber = useAuto ? await generateUniqueSealNumber() : manualSeal;

    if (!isValidSealNumber(sealNumber)) {
      return jsonError("Validation Error", "Seal number must be exactly 16 numeric digits.", 400);
    }

    const duplicateSeal = await prisma.inspectionLot.findFirst({
      where: { sealNumber },
      select: { id: true },
    });

    if (duplicateSeal) {
      return jsonError("Conflict", "Seal number already exists.", 409);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.inspectionLot.update({
        where: { id: lot.id },
        data: {
          sealNumber,
          sealAuto: useAuto,
        },
        select: {
          id: true,
          lotNumber: true,
          sealNumber: true,
          sealAuto: true,
          companyId: true,
        },
      });

      if (useAuto) {
        await createAuditSafe(tx, {
          jobId: lot.jobId,
          userId: currentUser.id,
          action: "SEAL_GENERATED",
          sealNumber,
          sealAuto: true,
        });
      }

      await createAuditSafe(tx, {
        jobId: lot.jobId,
        userId: currentUser.id,
        action: "SEAL_ASSIGNED",
        sealNumber,
        sealAuto: useAuto,
      });

      return result;
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return jsonError("Conflict", "Seal number already exists.", 409);
      }
    }

    const message = error instanceof Error ? error.message : "Failed to assign seal.";
    return jsonError("System Error", message, 500);
  }
}
