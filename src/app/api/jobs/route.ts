import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { authorize, AuthorizationError } from "@/lib/rbac";
import { workspaceJobSummarySelect } from "@/lib/job-workspace";

export const dynamic = "force-dynamic";

function jsonError(message: string, details: string, status: number) {
  return NextResponse.json({ error: message, details }, { status });
}

function isAuthorizationError(error: unknown): error is AuthorizationError {
  return error instanceof AuthorizationError;
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    const view = request.nextUrl.searchParams.get("view") ?? "my";

    if (view === "all") {
      authorize(currentUser, "VIEW_COMPANY_JOBS");
    } else if (view !== "my") {
      return jsonError("Invalid view", "view must be either my or all.", 400);
    }

    const where = view === "all"
      ? { companyId: currentUser.companyId }
      : { companyId: currentUser.companyId, assignedToId: currentUser.id };

    const jobs = await prisma.inspectionJob.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      select: workspaceJobSummarySelect,
    });

    return NextResponse.json(jobs);
  } catch (error: unknown) {
    if (isAuthorizationError(error)) {
      return jsonError("Forbidden", error.message, 403);
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonError("Failed to fetch jobs", message, 500);
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "CREATE_JOB");

    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null) {
      return jsonError("Invalid payload", "Request body must be a JSON object.", 400);
    }

    const payload = body as {
      clientName?: unknown;
      commodity?: unknown;
      companyId?: unknown;
      userId?: unknown;
      plantLocation?: unknown;
    };

    if (typeof payload.clientName !== "string" || typeof payload.commodity !== "string") {
      return jsonError("Missing required fields", "clientName and commodity are required.", 400);
    }

    if (payload.companyId !== undefined && payload.companyId !== currentUser.companyId) {
      return jsonError("Forbidden", "companyId mismatch for current user.", 403);
    }

    if (payload.userId !== undefined && payload.userId !== currentUser.id) {
      return jsonError("Forbidden", "userId mismatch for current user.", 403);
    }

    const { generateInspectionSerial } = await import("@/lib/serial");
    const serial = await generateInspectionSerial();

    const job = await prisma.inspectionJob.create({
      data: {
        companyId: currentUser.companyId,
        createdByUserId: currentUser.id,
        assignedToId: currentUser.id,
        assignedById: currentUser.id,
        assignedAt: new Date(),
        clientName: payload.clientName.trim(),
        commodity: payload.commodity.trim(),
        plantLocation: typeof payload.plantLocation === "string" && payload.plantLocation.trim().length > 0
          ? payload.plantLocation.trim()
          : null,
        inspectionSerialNumber: serial ?? "",
      },
      select: workspaceJobSummarySelect,
    });

    return NextResponse.json(job);
  } catch (error: unknown) {
    if (isAuthorizationError(error)) {
      return jsonError("Forbidden", error.message, 403);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return jsonError("Database error", error.message, 500);
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonError("Failed to create job", message, 500);
  }
}
