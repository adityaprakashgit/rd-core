import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";

export const dynamic = "force-dynamic";

function isMissingAuditTableError(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021";
}

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized", details: "Current user could not be resolved." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    const job = await prisma.inspectionJob.findUnique({
      where: { id: jobId },
      select: { companyId: true },
    });

    if (!job || job.companyId !== currentUser.companyId) {
      return NextResponse.json({ error: "Forbidden", details: "Cross-company access is not allowed." }, { status: 403 });
    }

    const logs = await prisma.auditLog.findMany({
      where: { jobId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        jobId: true,
        userId: true,
        entity: true,
        action: true,
        from: true,
        to: true,
        notes: true,
        metadata: true,
        createdAt: true,
        user: {
          select: {
            profile: {
              select: {
                displayName: true,
                companyName: true,
                avatarUrl: true,
              },
            },
            role: true,
          },
        },
      },
    });

    return NextResponse.json(logs);
  } catch (err: unknown) {
    if (isMissingAuditTableError(err)) {
      return NextResponse.json([]);
    }

    const error = err instanceof Error ? err : new Error("Unknown error");
    return NextResponse.json({ error: "System Error", details: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized", details: "Current user could not be resolved." }, { status: 401 });
    }

    const { jobId, userId, action, from, to, notes, entity, metadata } = await req.json();

    if (!jobId || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (userId !== undefined && userId !== currentUser.id) {
      return NextResponse.json({ error: "Forbidden", details: "Actor mismatch." }, { status: 403 });
    }

    const job = await prisma.inspectionJob.findUnique({
      where: { id: jobId },
      select: { companyId: true },
    });

    if (!job || job.companyId !== currentUser.companyId) {
      return NextResponse.json({ error: "Forbidden", details: "Cross-company access is not allowed." }, { status: 403 });
    }

    const log = await prisma.auditLog.create({
      data: {
        jobId,
        userId: currentUser.id,
        entity: typeof entity === "string" ? entity : "JOB",
        action,
        from,
        to,
        notes,
        metadata: metadata === undefined ? undefined : (metadata as Prisma.InputJsonValue),
      }
    });

    return NextResponse.json(log);
  } catch (err: unknown) {
    if (isMissingAuditTableError(err)) {
      return NextResponse.json({ skipped: true, reason: "Audit table missing" });
    }

    const error = err instanceof Error ? err : new Error("Unknown error");
    return NextResponse.json({ error: "System Error", details: error.message }, { status: 500 });
  }
}
