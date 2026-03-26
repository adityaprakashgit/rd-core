import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { authorize, AuthorizationError } from "@/lib/rbac";
import { generateUniqueSealNumber, isValidSealNumber } from "@/lib/traceability";

function jsonError(error: string, details: string, status: number) {
  return NextResponse.json({ error, details }, { status });
}

async function logAuditSafe(payload: { jobId?: string; userId: string; sealNumber: string }) {
  if (!payload.jobId) {
    return;
  }

  try {
    await prisma.auditLog.create({
      data: {
        jobId: payload.jobId,
        userId: payload.userId,
        entity: "LOT",
        action: "SEAL_GENERATED",
        metadata: {
          sealNumber: payload.sealNumber,
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

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "CREATE_LOT");

    const body: unknown = await request.json();
    const payload = typeof body === "object" && body !== null ? (body as { jobId?: unknown }) : {};
    const jobId = typeof payload.jobId === "string" && payload.jobId.trim().length > 0 ? payload.jobId.trim() : null;

    if (jobId) {
      const job = await prisma.inspectionJob.findUnique({
        where: { id: jobId },
        select: { companyId: true },
      });

      if (!job) {
        return jsonError("Not found", "Job not found.", 404);
      }

      if (job.companyId !== currentUser.companyId) {
        return jsonError("Forbidden", "Cross-company access is not allowed.", 403);
      }
    }

    const sealNumber = await generateUniqueSealNumber();
    if (!isValidSealNumber(sealNumber)) {
      return jsonError("Validation Error", "Seal number generation failed validation.", 500);
    }

    await logAuditSafe({ jobId: jobId ?? undefined, userId: currentUser.id, sealNumber });

    return NextResponse.json({ sealNumber });
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }

    const message = error instanceof Error ? error.message : "Failed to generate seal number.";
    return jsonError("System Error", message, 500);
  }
}
