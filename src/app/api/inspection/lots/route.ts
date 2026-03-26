import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { authorize, AuthorizationError } from "@/lib/rbac";

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized", details: "Current user could not be resolved." }, { status: 401 });
    }

    authorize(currentUser, "CREATE_LOT");

    const body = await req.json();
    const { jobId, lotNumber, totalBags } = body;

    if (!jobId || !lotNumber) {
      return NextResponse.json(
        { error: "Validation Error", details: "jobId and lotNumber are required fields." },
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

    const lot = await prisma.inspectionLot.create({
      data: {
        jobId,
        companyId: currentUser.companyId,
        lotNumber,
        totalBags: totalBags ?? 1,
      },
    });

    return NextResponse.json(lot);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Forbidden", details: error.message }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : "Internal Server Error";
    // Check for Prisma unique constraint violation code (JobId and LotNumber must be unique)
    if (error && typeof error === "object" && "code" in error && String((error as { code?: unknown }).code) === "P2002") {
      return NextResponse.json(
        { error: "Duplicate Lot Error", details: `Lot number already exists for this job.` },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create lot", details: message },
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

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json({ error: "Validation Error", details: "jobId search parameter is fundamentally required." }, { status: 400 });
    }

    const job = await prisma.inspectionJob.findUnique({
      where: { id: jobId },
      select: { companyId: true },
    });

    if (!job || job.companyId !== currentUser.companyId) {
      return NextResponse.json({ error: "Forbidden", details: "Cross-company access is not allowed." }, { status: 403 });
    }

    const lots = await prisma.inspectionLot.findMany({
      where: { jobId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(lots);
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { error: "Failed to fetch lots", details: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
