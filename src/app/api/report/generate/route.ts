import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateAndLinkRndReportSnapshot, ReportGenerationError } from "@/lib/rnd-report-generation";
import { getCurrentUserFromRequest } from "@/lib/session";
import { authorize, AuthorizationError } from "@/lib/rbac";

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized", details: "Current user could not be resolved." }, { status: 401 });
    }

    authorize(currentUser, "READ_ONLY");

    const payload = (await req.json()) as { jobId?: unknown; rndJobId?: unknown };
    const requestJobId = typeof payload?.jobId === "string" && payload.jobId.trim().length > 0
      ? payload.jobId.trim()
      : "";
    const rndJobId = typeof payload?.rndJobId === "string" && payload.rndJobId.trim().length > 0
      ? payload.rndJobId.trim()
      : "";

    if (!requestJobId && !rndJobId) {
      return NextResponse.json(
        { error: "Validation Error", details: "jobId or rndJobId is required." },
        { status: 400 }
      );
    }

    const snapshot = await prisma.$transaction(async (tx) =>
      generateAndLinkRndReportSnapshot(tx, {
        companyId: currentUser.companyId,
        jobId: requestJobId,
        rndJobId,
      }),
    );

    return NextResponse.json(snapshot);
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: "Forbidden", details: err.message }, { status: 403 });
    }
    if (err instanceof ReportGenerationError) {
      return NextResponse.json({ error: "Workflow Error", details: err.message }, { status: err.status });
    }

    const error = err instanceof Error ? err : new Error("Unknown error");
    return NextResponse.json(
      { error: "System Error", details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized", details: "Current user could not be resolved." }, { status: 401 });
    }

    authorize(currentUser, "READ_ONLY");

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json(
        { error: "Validation Error", details: "jobId is required." },
        { status: 400 }
      );
    }

    const job = await prisma.inspectionJob.findUnique({
      where: { id: jobId },
      select: { companyId: true },
    });

    if (!job || job.companyId !== currentUser.companyId) {
      return NextResponse.json({ error: "Forbidden", details: "Cross-company access is not allowed." }, { status: 403 });
    }

    const snapshots = await prisma.reportSnapshot.findMany({
      where: { jobId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(snapshots);
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: "Forbidden", details: err.message }, { status: 403 });
    }

    const error = err instanceof Error ? err : new Error("Unknown error");
    return NextResponse.json(
      { error: "System Error", details: error.message },
      { status: 500 }
    );
  }
}
