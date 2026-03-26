import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { authorize, AuthorizationError } from "@/lib/rbac";

function serializeTrials<T extends { measurements: Array<{ value: unknown }> }>(trials: T[]) {
  return trials.map((trial) => ({
    ...trial,
    measurements: trial.measurements.map((measurement) => ({
      ...measurement,
      value: Number(measurement.value),
    })),
  }));
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized", details: "Current user could not be resolved." }, { status: 401 });
    }

    authorize(currentUser, "MUTATE_RND");

    const body = await req.json();
    const { jobId, trialNumber } = body;

    if (!jobId || trialNumber === undefined) {
      return NextResponse.json(
        { error: "Validation Error", details: "jobId and trialNumber required to open a lab trial." },
        { status: 400 }
      );
    }

    // Wrap in tx to auto-create Experiment structure natively if it doesn't branch.
    const trial = await prisma.$transaction(async (tx) => {
      let experiment = await tx.rDExperiment.findFirst({ where: { jobId } });
      
      if (!experiment) {
         // Create default generic experiment
         experiment = await tx.rDExperiment.create({
            data: {
               jobId,
               title: "Default Lab Analytics",
               status: "ACTIVE"
            }
         });
      }

      // --- STATUS GUARD ---
      const job = await tx.inspectionJob.findUnique({
        where: { id: jobId },
        select: { status: true, companyId: true }
      });

      if (!job || job.companyId !== currentUser.companyId) {
        throw new Error("JOB_FORBIDDEN");
      }

      if (job?.status === "LOCKED") {
        throw new Error("JOB_LOCKED");
      }
      // ---------------------

      // Ensure no overlapping explicitly
      const existing = await tx.rDTrial.findFirst({
         where: { experimentId: experiment.id, trialNumber }
      });

      if (existing) {
         throw new Error("TRIAL_EXISTS");
      }

      const created = await tx.rDTrial.create({
         data: {
            experimentId: experiment.id,
            trialNumber,
            notes: "Dynamically Orchestrated Trial"
         }
      });
      return created;
    });

    return NextResponse.json(trial);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Forbidden", details: error.message }, { status: 403 });
    }

    if (error instanceof Error && error.message === "TRIAL_EXISTS") {
      return NextResponse.json(
        { error: "Conflict Action", details: "This trial sequence is already instantiated on the workflow." },
        { status: 409 }
      );
    }
    if (error instanceof Error && error.message === "JOB_FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden", details: "Cross-company access is not allowed." }, { status: 403 });
    }
    if (error instanceof Error && error.message === "JOB_LOCKED") {
      return NextResponse.json(
        { error: "Access Forbidden", details: "This job is LOCKED for audit integrity. No modifications allowed." },
        { status: 403 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to orchestrate Trial bindings.";
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

    authorize(currentUser, "READ_ONLY");

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
       return NextResponse.json({ error: "Validation Error", details: "jobId missing." }, { status: 400 });
    }

    const experiment = await prisma.rDExperiment.findFirst({
       where: { jobId, job: { companyId: currentUser.companyId } },
       include: {
          trials: {
             orderBy: { trialNumber: "asc" },
             include: { measurements: true }
          }
       }
    });

    return NextResponse.json(experiment ? serializeTrials(experiment.trials) : []);
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: "Forbidden", details: err.message }, { status: 403 });
    }

    const error = err as Error;
    return NextResponse.json({ error: "System Error", details: error.message || "Failed resolving trials" }, { status: 500 });
  }
}
