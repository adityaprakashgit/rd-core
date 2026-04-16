import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { authorize, AuthorizationError } from "@/lib/rbac";
import { buildSampleCode } from "@/lib/sample-management";

const sampleInclude = {
  media: true,
  sealLabel: true,
  events: true,
} as const;

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
            inspection: true,
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

    const incompleteLots = job.lots.filter(
      (lot) =>
        lot.inspection?.inspectionStatus !== "COMPLETED" ||
        lot.inspection?.decisionStatus !== "READY_FOR_SAMPLING",
    );

    if (incompleteLots.length > 0) {
      return NextResponse.json(
        { 
          error: "Workflow Error", 
          details: `All lots must pass inspection before creating the job-level homogeneous sample. Blocking lots: ${incompleteLots.map((lot) => lot.lotNumber).join(", ")}.`
        },
        { status: 400 }
      );
    }

    const sample = await prisma.$transaction(async (tx) => {
      const existing = await tx.sample.findFirst({
        where: { jobId },
        include: sampleInclude,
      });
      if (existing) {
        return existing;
      }

      const created = await tx.sample.create({
        data: {
          companyId: currentUser.companyId,
          jobId,
          lotId: null,
          inspectionId: null,
          sampleCode: buildSampleCode(job.inspectionSerialNumber, "HOMO"),
          sampleStatus: photoUrl ? "SAMPLING_IN_PROGRESS" : "CREATED",
          sampleType: "HOMOGENEOUS",
          samplingMethod: "SCOOPS_FROM_ALL_LOTS",
          samplingDate: new Date(),
          homogeneousProofDone: Boolean(photoUrl),
          homogenizedAt: photoUrl ? new Date() : null,
          remarks: "Job-level homogeneous sample created from all passed lots.",
          createdById: currentUser.id,
          ...(photoUrl
            ? {
                media: {
                  create: {
                    mediaType: "HOMOGENIZED_SAMPLE",
                    fileUrl: photoUrl,
                    capturedById: currentUser.id,
                    remarks: "Migrated homogeneous sample photo.",
                  },
                },
              }
            : {}),
        },
        include: sampleInclude,
      });

      return created;
    });

    return NextResponse.json(sample);

  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: "Forbidden", details: err.message }, { status: 403 });
    }

    if (err && typeof err === "object" && "code" in err && String((err as { code?: unknown }).code) === "P2002") {
      return NextResponse.json(
        { error: "Conflict Action", details: "A job-level homogeneous sample has already been created for this job." },
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

    const job = await prisma.inspectionJob.findUnique({
      where: { id: jobId },
      select: { companyId: true },
    });

    if (!job || job.companyId !== currentUser.companyId) {
      return NextResponse.json({ error: "Forbidden", details: "Cross-company access is not allowed." }, { status: 403 });
    }

    const sample = await prisma.sample.findFirst({
      where: { jobId },
      include: sampleInclude,
    });

    return NextResponse.json(sample);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch homogeneous sample.";
    return NextResponse.json({ error: "System Error", details: message }, { status: 500 });
  }
}
