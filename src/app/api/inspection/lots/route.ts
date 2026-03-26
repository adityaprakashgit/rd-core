import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobId, lotNumber, totalBags } = body;

    if (!jobId || !lotNumber) {
      return NextResponse.json(
        { error: "Validation Error", details: "jobId and lotNumber are required fields." },
        { status: 400 }
      );
    }

    const lot = await prisma.inspectionLot.create({
      data: {
        jobId,
        lotNumber,
        totalBags: totalBags ?? 1,
      },
    });

    return NextResponse.json(lot);
  } catch (error: any) {
    // Check for Prisma unique constraint violation code (JobId and LotNumber must be unique)
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "Duplicate Lot Error", details: `Lot number already exists for this job.` },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create lot", details: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json({ error: "Validation Error", details: "jobId search parameter is fundamentally required." }, { status: 400 });
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
