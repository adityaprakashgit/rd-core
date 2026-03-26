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

    authorize(currentUser, "MUTATE_RND");

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

    if (job.companyId !== currentUser.companyId) {
      return NextResponse.json(
        { error: "Forbidden", details: "Cross-company access is not allowed." },
        { status: 403 }
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

  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: "Forbidden", details: err.message }, { status: 403 });
    }

    if (err && typeof err === "object" && "code" in err && String((err as { code?: unknown }).code) === "P2002") {
      return NextResponse.json(
        { error: "Conflict Action", details: "A homogeneous sample has already been created for this job." },
        { status: 409 }
      );
    }
    const message = err instanceof Error ? err.message : "Failed to create homogeneous sample.";
    return NextResponse.json(
      { error: "System Error", details: message },
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
      return NextResponse.json(
        { error: "Validation Error", details: "jobId is required." },
        { status: 400 }
      );
    }

    const sample = await prisma.homogeneousSample.findFirst({
      where: { jobId }
    });

    if (sample) {
      const job = await prisma.inspectionJob.findUnique({
        where: { id: sample.jobId },
        select: { companyId: true },
      });

      if (!job || job.companyId !== currentUser.companyId) {
        return NextResponse.json({ error: "Forbidden", details: "Cross-company access is not allowed." }, { status: 403 });
      }
    }

    return NextResponse.json(sample);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch homogeneous sample.";
    return NextResponse.json({ error: "System Error", details: message }, { status: 500 });
  }
}
