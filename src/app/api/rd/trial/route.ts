import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
        select: { status: true }
      });

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
    if (error instanceof Error && error.message === "TRIAL_EXISTS") {
      return NextResponse.json(
        { error: "Conflict Action", details: "This trial sequence is already instantiated on the workflow." },
        { status: 409 }
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
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
       return NextResponse.json({ error: "Validation Error", details: "jobId missing." }, { status: 400 });
    }

    const experiment = await prisma.rDExperiment.findFirst({
       where: { jobId },
       include: {
          trials: {
             orderBy: { trialNumber: "asc" },
             include: { measurements: true }
          }
       }
    });

    return NextResponse.json(experiment ? serializeTrials(experiment.trials) : []);
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: "System Error", details: error.message || "Failed resolving trials" }, { status: 500 });
  }
}
