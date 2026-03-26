import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lotId, beforePhotoUrl, duringPhotoUrl, afterPhotoUrl } = body;

    if (!lotId) {
      return NextResponse.json(
        { error: "Validation Error", details: "lotId is strictly required to record a sample." },
        { status: 400 }
      );
    }

    const lot = await prisma.inspectionLot.findUnique({
      where: { id: lotId },
    });

    if (!lot) {
      return NextResponse.json(
        { error: "Not Found", details: "The specified Lot does not exist in the system." },
        { status: 404 }
      );
    }

    // --- STATUS GUARD ---
    const job = await prisma.inspectionJob.findUnique({
      where: { id: lot.jobId },
      select: { status: true }
    });

    if (job?.status === "LOCKED") {
      return NextResponse.json(
        { error: "Access Forbidden", details: "This job is LOCKED for audit integrity. No modifications allowed." },
        { status: 403 }
      );
    }
    // ---------------------

    const existing = await prisma.sampling.findUnique({
      where: { lotId },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Conflict Action", details: "A sampling process has already been recorded for this lot. Resampling is not permitted." },
        { status: 409 }
      );
    }

    const sampling = await prisma.sampling.create({
      data: {
        lotId,
        beforePhotoUrl,
        duringPhotoUrl,
        afterPhotoUrl,
      },
    });

    return NextResponse.json(sampling);
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "Conflict Action", details: "A sampling constraint violation occurred. Resampling is not permitted." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "System Error", details: err?.message || "Failed to create sampling record." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lotId = searchParams.get("lotId");

    if (!lotId) {
      return NextResponse.json(
        { error: "Validation Error", details: "lotId is required." },
        { status: 400 }
      );
    }

    const sampling = await prisma.sampling.findUnique({
      where: { lotId },
    });

    return NextResponse.json(sampling);
  } catch (err: any) {
    return NextResponse.json(
      { error: "System Error", details: err?.message || "Failed to fetch sampling record." },
      { status: 500 }
    );
  }
}
