import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { jobId } = await req.json();

    if (!jobId) {
      return NextResponse.json(
        { error: "Validation Error", details: "jobId is required." },
        { status: 400 }
      );
    }

    // 1. Fetch full data graph
    const job = await prisma.inspectionJob.findUnique({
      where: { id: jobId },
      include: {
        lots: {
          include: {
            bags: true,
            sampling: true,
          },
        },
        homogeneousSamples: {
          include: {
            packets: true,
          },
        },
        experiments: {
          include: {
            trials: {
              include: {
                measurements: true,
              },
            },
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Not Found", details: "Job not found." },
        { status: 404 }
      );
    }

    // 2. Aggregate into a snapshot data structure
    // We store the whole object as is (Prisma result is JSON-compatible)
    // but we can add meta-information if needed.
    const snapshotData = {
      generatedAt: new Date().toISOString(),
      job,
    };

    // 3. Save snapshot (Immutable)
    const snapshot = await prisma.reportSnapshot.create({
      data: {
        jobId,
        data: snapshotData as any,
      },
    });

    return NextResponse.json(snapshot);
  } catch (err: any) {
    return NextResponse.json(
      { error: "System Error", details: err.message },
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

    const snapshots = await prisma.reportSnapshot.findMany({
      where: { jobId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(snapshots);
  } catch (err: any) {
    return NextResponse.json(
      { error: "System Error", details: err.message },
      { status: 500 }
    );
  }
}
