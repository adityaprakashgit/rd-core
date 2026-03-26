import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { authorize, AuthorizationError } from "@/lib/rbac";
import { getCurrentUserFromRequest } from "@/lib/session";

function jsonError(error: string, details: string, status: number) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "READ_ONLY");

    const [clients, transporters, items] = await Promise.all([
      prisma.clientMaster.findMany({
        where: { companyId: currentUser.companyId, isActive: true },
        orderBy: { clientName: "asc" },
        select: {
          clientName: true,
          billToAddress: true,
          shipToAddress: true,
          gstOrId: true,
        },
      }),
      prisma.transporterMaster.findMany({
        where: { companyId: currentUser.companyId, isActive: true },
        orderBy: { transporterName: "asc" },
        select: {
          transporterName: true,
          contactPerson: true,
          phone: true,
          email: true,
          address: true,
          gstOrId: true,
        },
      }),
      prisma.itemMaster.findMany({
        where: { companyId: currentUser.companyId, isActive: true },
        orderBy: { itemName: "asc" },
        select: {
          itemName: true,
          description: true,
          uom: true,
        },
      }),
    ]);

    return NextResponse.json({ clients, transporters, items });
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }
    const message = error instanceof Error ? error.message : "Failed to load dispatch master options.";
    return jsonError("System Error", message, 500);
  }
}
