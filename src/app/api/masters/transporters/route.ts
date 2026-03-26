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

    const rows = await prisma.transporterMaster.findMany({
      where: { companyId: currentUser.companyId, ...(typeof isActiveFilter === "boolean" ? { isActive: isActiveFilter } : {}) },
      orderBy: { transporterName: "asc" },
      select: {
        transporterName: true,
        contactPerson: true,
        phone: true,
        email: true,
        address: true,
        gstOrId: true,
      },
    });

    return NextResponse.json(rows);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }
    const message = error instanceof Error ? error.message : "Failed to fetch transporter master.";
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
          transporterName?: unknown;
          contactPerson?: unknown;
          phone?: unknown;
          email?: unknown;
          address?: unknown;
          gstOrId?: unknown;
          isActive?: unknown;
        })
      : {};

    const transporterName = asNonEmptyString(payload.transporterName);
    if (!transporterName) {
      return jsonError("Validation Error", "transporterName is required.", 400);
    }

    const record = await prisma.transporterMaster.upsert({
      where: {
        companyId_transporterName: {
          companyId: currentUser.companyId,
          transporterName,
        },
      },
      update: {
        contactPerson: asNonEmptyString(payload.contactPerson),
        phone: asNonEmptyString(payload.phone),
        email: asNonEmptyString(payload.email),
        address: asNonEmptyString(payload.address),
        gstOrId: asNonEmptyString(payload.gstOrId),
        isActive: payload.isActive === false ? false : true,
      },
      create: {
        companyId: currentUser.companyId,
        transporterName,
        contactPerson: asNonEmptyString(payload.contactPerson),
        phone: asNonEmptyString(payload.phone),
        email: asNonEmptyString(payload.email),
        address: asNonEmptyString(payload.address),
        gstOrId: asNonEmptyString(payload.gstOrId),
        isActive: payload.isActive === false ? false : true,
      },
      select: {
        transporterName: true,
        contactPerson: true,
        phone: true,
        email: true,
        address: true,
        gstOrId: true,
      },
    });

    return NextResponse.json(record);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }
    const message = error instanceof Error ? error.message : "Failed to save transporter master.";
    return jsonError("System Error", message, 500);
  }
}
