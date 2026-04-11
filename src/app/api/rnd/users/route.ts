import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthorizationError, authorize } from "@/lib/rbac";
import { searchRndUsers } from "@/lib/rnd-user-picker";
import { getCurrentUserFromRequest } from "@/lib/session";

function jsonError(error: string, details: string, status: number) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) return jsonError("Unauthorized", "Current user could not be resolved.", 401);

    authorize(currentUser, "READ_ONLY");

    const qp = request.nextUrl.searchParams;
    const q = qp.get("q") ?? "";
    const roleScope = (qp.get("roleScope") ?? "ASSIGNEE").trim().toUpperCase();
    const roles = roleScope === "APPROVER" ? (["ADMIN", "RND"] as const) : (["RND"] as const);

    const options = await searchRndUsers({
      prismaClient: prisma,
      companyId: currentUser.companyId,
      roles: [...roles],
      query: q,
      limit: 25,
    });

    return NextResponse.json({ options });
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) return jsonError("Forbidden", error.message, 403);
    const message = error instanceof Error ? error.message : "Failed to search users.";
    return jsonError("System Error", message, 500);
  }
}
