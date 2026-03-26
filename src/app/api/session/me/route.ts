import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserFromRequest } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const currentUser = await getCurrentUserFromRequest(request);

  if (!currentUser) {
    return NextResponse.json(
      { error: "Unauthorized", details: "Current user could not be resolved." },
      { status: 401 }
    );
  }

  return NextResponse.json({
    role: currentUser.role,
    email: currentUser.email,
    profile: currentUser.profile,
  });
}
