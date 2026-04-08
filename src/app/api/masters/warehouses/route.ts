import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { authorize, AuthorizationError } from "@/lib/rbac";
import { getCurrentUserFromRequest } from "@/lib/session";

function jsonError(error: string, details: string, status: number) {
  return NextResponse.json({ error, details }, { status });
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "READ_ONLY");

    const status = request.nextUrl.searchParams.get("status");
    const isActiveFilter =
      status === "inactive" ? false : status === "all" ? undefined : true;

    const rows = await prisma.warehouseMaster.findMany({
      where: { companyId: currentUser.companyId, ...(typeof isActiveFilter === "boolean" ? { isActive: isActiveFilter } : {}) },
      orderBy: { warehouseName: "asc" },
      select: {
        warehouseName: true,
        description: true,
      },
    });

    return NextResponse.json(rows);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }
    const message = error instanceof Error ? error.message : "Failed to fetch warehouse master.";
    return jsonError("System Error", message, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "CREATE_JOB");

    const body: unknown = await request.json();
    const payload = typeof body === "object" && body !== null
      ? (body as {
          warehouseName?: unknown;
          description?: unknown;
          isActive?: unknown;
        })
      : {};

    const warehouseName = asNonEmptyString(payload.warehouseName);
    if (!warehouseName) {
      return jsonError("Validation Error", "warehouseName is required.", 400);
    }

    const record = await prisma.warehouseMaster.upsert({
      where: {
        companyId_warehouseName: {
          companyId: currentUser.companyId,
          warehouseName,
        },
      },
      update: {
        description: asNonEmptyString(payload.description),
        isActive: payload.isActive === false ? false : true,
      },
      create: {
        companyId: currentUser.companyId,
        warehouseName,
        description: asNonEmptyString(payload.description),
        isActive: payload.isActive === false ? false : true,
      },
      select: {
        warehouseName: true,
        description: true,
      },
    });

    return NextResponse.json(record);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }
    const message = error instanceof Error ? error.message : "Failed to save warehouse master.";
    return jsonError("System Error", message, 500);
  }
}
