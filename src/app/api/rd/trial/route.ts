import { NextRequest, NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { AuthorizationError, authorize } from "@/lib/rbac";
import { getCurrentUserFromRequest } from "@/lib/session";

function serializeTrials<
  T extends {
    measurements: Array<{ value: unknown }>;
    packet?: {
      id: string;
      packetCode: string;
      packetType: string | null;
      packetQuantity: number | null;
      packetUnit: string | null;
    } | null;
  },
>(trials: T[]) {
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
    const jobId = typeof body?.jobId === "string" ? body.jobId.trim() : "";
    const packetId = typeof body?.packetId === "string" ? body.packetId.trim() : "";
    const trialNumber = body?.trialNumber;

    if (!jobId || !packetId || trialNumber === undefined) {
      return NextResponse.json(
        { error: "Validation Error", details: "jobId, packetId, and trialNumber are required to start a trial." },
        { status: 400 },
      );
    }

    const trial = await prisma.$transaction(async (tx) => {
      let experiment = await tx.rDExperiment.findFirst({ where: { jobId } });

      if (!experiment) {
        experiment = await tx.rDExperiment.create({
          data: {
            jobId,
            title: "Default Lab Analytics",
            status: "ACTIVE",
          },
        });
      }

      const job = await tx.inspectionJob.findUnique({
        where: { id: jobId },
        select: { id: true, status: true, companyId: true },
      });

      if (!job || job.companyId !== currentUser.companyId) {
        throw new Error("JOB_FORBIDDEN");
      }
      if (job.status === "LOCKED") {
        throw new Error("JOB_LOCKED");
      }

      const packet = await tx.packet.findUnique({
        where: { id: packetId },
        include: {
          allocation: true,
        },
      });

      if (!packet || packet.jobId !== jobId || packet.companyId !== currentUser.companyId) {
        throw new Error("PACKET_NOT_FOUND");
      }

      if (packet.packetStatus !== "AVAILABLE" || packet.allocation?.allocationStatus !== "AVAILABLE") {
        throw new Error("PACKET_UNAVAILABLE");
      }

      const existing = await tx.rDTrial.findFirst({
        where: { experimentId: experiment.id, trialNumber },
      });

      if (existing) {
        throw new Error("TRIAL_EXISTS");
      }

      const created = await tx.rDTrial.create({
        data: {
          experimentId: experiment.id,
          lotId: null,
          packetId: packet.id,
          trialNumber,
          notes: `Trial created from packet ${packet.packetCode}`,
        },
        include: {
          measurements: true,
          packet: {
            select: {
              id: true,
              packetCode: true,
              packetType: true,
              packetQuantity: true,
              packetUnit: true,
            },
          },
        },
      });

      await tx.packetAllocation.update({
        where: { packetId: packet.id },
        data: {
          allocationStatus: "ALLOCATED",
          allocatedToType: "TRIAL",
          allocatedToId: created.id,
          allocatedAt: new Date(),
        },
      });

      await tx.packet.update({
        where: { id: packet.id },
        data: {
          packetStatus: "ALLOCATED",
        },
      });

      await tx.packetEvent.create({
        data: {
          packetId: packet.id,
          eventType: "PACKET_ASSIGNED_TO_TRIAL",
          performedById: currentUser.id,
          metadata: {
            trialId: created.id,
            trialNumber: created.trialNumber,
          },
        },
      });

      await recordAuditLog(tx, {
        jobId,
        userId: currentUser.id,
        entity: "TRIAL",
        action: "TRIAL_CREATED",
        metadata: {
          trialId: created.id,
          trialNumber: created.trialNumber,
          packetId: packet.id,
          packetCode: packet.packetCode,
        },
      });

      await recordAuditLog(tx, {
        jobId,
        userId: currentUser.id,
        entity: "PACKET",
        action: "PACKET_ALLOCATED",
        to: "ALLOCATED",
        metadata: {
          packetId: packet.id,
          packetCode: packet.packetCode,
          trialId: created.id,
        },
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
        { error: "Conflict Action", details: "This trial sequence already exists." },
        { status: 409 },
      );
    }
    if (error instanceof Error && error.message === "JOB_FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden", details: "Cross-company access is not allowed." }, { status: 403 });
    }
    if (error instanceof Error && error.message === "JOB_LOCKED") {
      return NextResponse.json(
        { error: "Access Forbidden", details: "This job is LOCKED for audit integrity. No modifications allowed." },
        { status: 403 },
      );
    }
    if (error instanceof Error && error.message === "PACKET_NOT_FOUND") {
      return NextResponse.json(
        { error: "Workflow Error", details: "Select a valid packet before starting a trial." },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message === "PACKET_UNAVAILABLE") {
      return NextResponse.json(
        { error: "Workflow Error", details: "Only AVAILABLE packets can be assigned to a trial." },
        { status: 400 },
      );
    }

    const message = error instanceof Error ? error.message : "Failed to create trial.";
    return NextResponse.json({ error: "System Error", details: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized", details: "Current user could not be resolved." }, { status: 401 });
    }

    authorize(currentUser, "READ_ONLY");

    const jobId = req.nextUrl.searchParams.get("jobId");
    if (!jobId) {
      return NextResponse.json({ error: "Validation Error", details: "jobId missing." }, { status: 400 });
    }

    const experiment = await prisma.rDExperiment.findFirst({
      where: { jobId, job: { companyId: currentUser.companyId } },
      include: {
        trials: {
          orderBy: { trialNumber: "asc" },
          include: {
            measurements: true,
            packet: {
              select: {
                id: true,
                packetCode: true,
                packetType: true,
                packetQuantity: true,
                packetUnit: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(experiment ? serializeTrials(experiment.trials) : []);
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: "Forbidden", details: err.message }, { status: 403 });
    }

    const error = err as Error;
    return NextResponse.json(
      { error: "System Error", details: error.message || "Failed resolving trials" },
      { status: 500 },
    );
  }
}
