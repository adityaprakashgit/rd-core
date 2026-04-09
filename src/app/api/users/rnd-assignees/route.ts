import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthorizationError, authorize } from "@/lib/rbac";
import { getCurrentUserFromRequest } from "@/lib/session";

export const dynamic = "force-dynamic";

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

    const rows = await prisma.user.findMany({
      where: {
        companyId: currentUser.companyId,
        role: "RND",
        isActive: true,
      },
      orderBy: [{ createdAt: "asc" }],
      select: {
        id: true,
        email: true,
        role: true,
        profile: {
          select: {
            displayName: true,
          },
        },
      },
    });

    return NextResponse.json(
      rows.map((row) => ({
        id: row.id,
        email: row.email,
        role: row.role,
        displayName: row.profile?.displayName ?? row.email ?? "R&D User",
      })),
    );
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }
    const message = error instanceof Error ? error.message : "Failed to load R&D assignees.";
    return jsonError("System Error", message, 500);
  }
}
