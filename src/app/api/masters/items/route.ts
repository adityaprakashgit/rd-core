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

    const rows = await prisma.itemMaster.findMany({
      where: { companyId: currentUser.companyId, ...(typeof isActiveFilter === "boolean" ? { isActive: isActiveFilter } : {}) },
      orderBy: { itemName: "asc" },
      select: {
        itemName: true,
        description: true,
        uom: true,
      },
    });

    return NextResponse.json(rows);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }
    const message = error instanceof Error ? error.message : "Failed to fetch item master.";
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
          itemName?: unknown;
          description?: unknown;
          uom?: unknown;
          isActive?: unknown;
        })
      : {};

    const itemName = asNonEmptyString(payload.itemName);
    if (!itemName) {
      return jsonError("Validation Error", "itemName is required.", 400);
    }

    const record = await prisma.itemMaster.upsert({
      where: {
        companyId_itemName: {
          companyId: currentUser.companyId,
          itemName,
        },
      },
      update: {
        description: asNonEmptyString(payload.description),
        uom: asNonEmptyString(payload.uom),
        isActive: payload.isActive === false ? false : true,
      },
      create: {
        companyId: currentUser.companyId,
        itemName,
        description: asNonEmptyString(payload.description),
        uom: asNonEmptyString(payload.uom),
        isActive: payload.isActive === false ? false : true,
      },
      select: {
        itemName: true,
        description: true,
        uom: true,
      },
    });

    return NextResponse.json(record);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }
    const message = error instanceof Error ? error.message : "Failed to save item master.";
    return jsonError("System Error", message, 500);
  }
}
