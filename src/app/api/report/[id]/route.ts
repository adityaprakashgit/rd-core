import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { authorize, AuthorizationError } from "@/lib/rbac";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized", details: "Current user could not be resolved." }, { status: 401 });
    }

    authorize(currentUser, "READ_ONLY");

    const { id } = await params;

    const snapshot = await prisma.reportSnapshot.findUnique({
      where: { id },
      include: {
        job: {
          select: {
            companyId: true,
          },
        },
      },
    });

    if (!snapshot) {
      return NextResponse.json(
        { error: "Not Found", details: "Snapshot not found." },
        { status: 404 }
      );
    }

    if (snapshot.job.companyId !== currentUser.companyId) {
      return NextResponse.json(
        { error: "Forbidden", details: "Cross-company access is not allowed." },
        { status: 403 }
      );
    }

    return NextResponse.json({
      id: snapshot.id,
      jobId: snapshot.jobId,
      data: snapshot.data,
      createdAt: snapshot.createdAt,
    });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: "Forbidden", details: err.message }, { status: 403 });
    }

    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "System Error", details: message },
      { status: 500 }
    );
  }
}
