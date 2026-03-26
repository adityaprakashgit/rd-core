import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobId, photoUrl } = body;

    if (!jobId) {
      return NextResponse.json(
        { error: "Validation Error", details: "jobId is required." },
        { status: 400 }
      );
    }

    const job = await prisma.inspectionJob.findUnique({
      where: { id: jobId },
      include: {
        lots: {
          include: {
            sampling: true
          }
        }
      }
    });

    if (!job) {
      return NextResponse.json(
        { error: "Not Found", details: "The specified Job does not exist." },
        { status: 404 }
      );
    }

    // Validation #2: Job must have lots
    if (job.lots.length === 0) {
      return NextResponse.json(
        { error: "Workflow Error", details: "Cannot create homogeneous sample: Job has zero lots registered." },
        { status: 400 }
      );
    }

    // Validation #3: All lots must be strictly sampled
    const incompleteLots = job.lots.filter(lot => {
      // Prismas 1-to-M mapped relation generates an Array, pull uniquely bound index 0
      const s = Array.isArray(lot.sampling) ? lot.sampling[0] : lot.sampling;
      if (!s) return true;
      if (!s.beforePhotoUrl || !s.duringPhotoUrl || !s.afterPhotoUrl) return true;
      return false;
    });

    if (incompleteLots.length > 0) {
      return NextResponse.json(
        { 
          error: "Workflow Error", 
          details: `Operations incomplete. ${incompleteLots.length} lot(s) are missing finalized sampling states or photos.`
        },
        { status: 400 }
      );
    }

    const sample = await prisma.homogeneousSample.create({
      data: {
        jobId,
        photoUrl: photoUrl || null,
      }
    });

    return NextResponse.json(sample);

  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "Conflict Action", details: "A homogeneous sample has already been created for this job." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "System Error", details: err?.message || "Failed to create homogeneous sample." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json(
        { error: "Validation Error", details: "jobId is required." },
        { status: 400 }
      );
    }

    const sample = await prisma.homogeneousSample.findFirst({
      where: { jobId }
    });

    return NextResponse.json(sample);
  } catch (err: any) {
    return NextResponse.json(
      { error: "System Error", details: err?.message || "Failed to fetch homogeneous sample." },
      { status: 500 }
    );
  }
}
