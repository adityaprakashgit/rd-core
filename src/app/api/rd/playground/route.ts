import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { authorize, AuthorizationError } from "@/lib/rbac";
import { getCurrentUserFromRequest } from "@/lib/session";

type PlaygroundBoardPayload = {
  steps?: unknown[];
  trials?: unknown[];
  packets?: unknown[];
  selectedTrialId?: string | null;
};

function parseBoard(raw: string | null): PlaygroundBoardPayload {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as PlaygroundBoardPayload;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

async function resolveJobScope(jobId: string, companyId: string) {
  const job = await prisma.inspectionJob.findUnique({
    where: { id: jobId },
    select: { id: true, companyId: true },
  });

  if (!job || job.companyId !== companyId) {
    return null;
  }
  return job;
}

async function findOrCreateExperiment(jobId: string) {
  const existing = await prisma.rDExperiment.findFirst({
    where: { jobId },
    orderBy: { createdAt: "asc" },
  });

  if (existing) return existing;

  return prisma.rDExperiment.create({
    data: {
      jobId,
      title: "R&D Playground",
      status: "BUILDING",
      hypothesis: null,
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized", details: "Current user could not be resolved." }, { status: 401 });
    }

    authorize(currentUser, "MUTATE_RND");

    const jobId = req.nextUrl.searchParams.get("jobId");
    if (!jobId) {
      return NextResponse.json({ error: "Validation Error", details: "jobId is required." }, { status: 400 });
    }

    const job = await resolveJobScope(jobId, currentUser.companyId);
    if (!job) {
      return NextResponse.json({ error: "Forbidden", details: "Cross-company access is not allowed." }, { status: 403 });
    }

    const experiment = await findOrCreateExperiment(job.id);
    const board = parseBoard(experiment.hypothesis);

    const packets = await prisma.packet.findMany({
      where: { jobId: job.id },
      orderBy: [{ lot: { lotNumber: "asc" } }, { packetNo: "asc" }],
      select: {
        id: true,
        packetCode: true,
        packetStatus: true,
        packetQuantity: true,
      },
    });

    return NextResponse.json({
      experimentId: experiment.id,
      jobId: job.id,
      status: experiment.status,
      board,
      packets: packets.map((packet) => ({
        id: packet.id,
        code: packet.packetCode,
        quantity: packet.packetQuantity ?? 1,
        status: packet.packetStatus,
      })),
    });
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Forbidden", details: error.message }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : "Failed to load playground.";
    return NextResponse.json({ error: "System Error", details: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized", details: "Current user could not be resolved." }, { status: 401 });
    }

    authorize(currentUser, "MUTATE_RND");

    const body = await req.json();
    const jobId = typeof body?.jobId === "string" ? body.jobId : "";
    const status = typeof body?.status === "string" ? body.status : "BUILDING";
    const board = typeof body?.board === "object" && body?.board !== null ? (body.board as PlaygroundBoardPayload) : {};
    const action = typeof body?.action === "string" ? body.action : "PLAYGROUND_SAVE";

    if (!jobId) {
      return NextResponse.json({ error: "Validation Error", details: "jobId is required." }, { status: 400 });
    }

    const job = await resolveJobScope(jobId, currentUser.companyId);
    if (!job) {
      return NextResponse.json({ error: "Forbidden", details: "Cross-company access is not allowed." }, { status: 403 });
    }

    const experiment = await findOrCreateExperiment(job.id);
    if (experiment.status === "LOCKED" && status !== "LOCKED") {
      return NextResponse.json({ error: "Forbidden", details: "Experiment is locked and cannot be modified." }, { status: 403 });
    }

    const updated = await prisma.rDExperiment.update({
      where: { id: experiment.id },
      data: {
        status,
        hypothesis: JSON.stringify(board),
      },
      select: {
        id: true,
        jobId: true,
        status: true,
        hypothesis: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        jobId: job.id,
        userId: currentUser.id,
        entity: "PLAYGROUND",
        action,
        from: experiment.status,
        to: updated.status,
        metadata: {
          stepCount: Array.isArray(board.steps) ? board.steps.length : 0,
          trialCount: Array.isArray(board.trials) ? board.trials.length : 0,
          selectedTrialId: board.selectedTrialId ?? null,
        } as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      success: true,
      experimentId: updated.id,
      status: updated.status,
      board: parseBoard(updated.hypothesis),
    });
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Forbidden", details: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Failed to persist playground.";
    return NextResponse.json({ error: "System Error", details: message }, { status: 500 });
  }
}
