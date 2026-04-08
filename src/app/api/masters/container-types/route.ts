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

    const rows = await prisma.containerTypeMaster.findMany({
      where: { companyId: currentUser.companyId, isActive: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(rows);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }
    const message = error instanceof Error ? error.message : "Failed to load container types.";
    return jsonError("System Error", message, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "MANAGE_MODULE_SETTINGS");

    const body = await request.json();
    const name = asNonEmptyString(body?.name);
    if (!name) {
      return jsonError("Validation Error", "name is required.", 400);
    }

    const record = await prisma.containerTypeMaster.upsert({
      where: {
        companyId_name: {
          companyId: currentUser.companyId,
          name,
        },
      },
      update: { isActive: true },
      create: {
        companyId: currentUser.companyId,
        name,
      },
    });

    return NextResponse.json(record);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }
    const message = error instanceof Error ? error.message : "Failed to save container type.";
    return jsonError("System Error", message, 500);
  }
}
