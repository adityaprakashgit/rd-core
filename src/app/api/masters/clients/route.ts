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

    const rows = await prisma.clientMaster.findMany({
      where: { companyId: currentUser.companyId, ...(typeof isActiveFilter === "boolean" ? { isActive: isActiveFilter } : {}) },
      orderBy: { clientName: "asc" },
      select: {
        clientName: true,
        billToAddress: true,
        shipToAddress: true,
        gstOrId: true,
      },
    });

    return NextResponse.json(rows);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }
    const message = error instanceof Error ? error.message : "Failed to fetch client master.";
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
          clientName?: unknown;
          billToAddress?: unknown;
          shipToAddress?: unknown;
          gstOrId?: unknown;
          isActive?: unknown;
        })
      : {};

    const clientName = asNonEmptyString(payload.clientName);
    const billToAddress = asNonEmptyString(payload.billToAddress);
    const shipToAddress = asNonEmptyString(payload.shipToAddress);

    if (!clientName || !billToAddress || !shipToAddress) {
      return jsonError("Validation Error", "clientName, billToAddress, and shipToAddress are required.", 400);
    }

    const gstOrId = asNonEmptyString(payload.gstOrId);
    const isActive = payload.isActive === false ? false : true;

    const record = await prisma.clientMaster.upsert({
      where: {
        companyId_clientName: {
          companyId: currentUser.companyId,
          clientName,
        },
      },
      update: {
        billToAddress,
        shipToAddress,
        gstOrId,
        isActive,
      },
      create: {
        companyId: currentUser.companyId,
        clientName,
        billToAddress,
        shipToAddress,
        gstOrId,
        isActive,
      },
      select: {
        clientName: true,
        billToAddress: true,
        shipToAddress: true,
        gstOrId: true,
      },
    });

    return NextResponse.json(record);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }
    const message = error instanceof Error ? error.message : "Failed to save client master.";
    return jsonError("System Error", message, 500);
  }
}
