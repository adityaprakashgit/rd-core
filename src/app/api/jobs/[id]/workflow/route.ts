import { NextRequest, NextResponse } from "next/server";

import {
  buildModuleWorkflowSettingsCreate,
  canApproveFinalDecision,
  toModuleWorkflowPolicy,
} from "@/lib/module-workflow-policy";
import { prisma } from "@/lib/prisma";
import { authorize, AuthorizationError } from "@/lib/rbac";
import { getCurrentUserFromRequest } from "@/lib/session";
import { workspaceJobSelect } from "@/lib/job-workspace";
import type { PacketRecord, PublicUser, SampleEventRecord } from "@/types/inspection";

type WorkflowJobLot = {
  id: string;
  lotNumber: string;
  status?: string | null;
  createdAt: string | Date;
  mediaFiles?: Array<{ category: string }>;
  inspection?: {
    decisionStatus?: string | null;
    overallRemark?: string | null;
  } | null;
  sealNumber?: string | null;
  assignedBy?: PublicUser | null;
  sample?: {
    homogeneousProofDone?: boolean;
    homogenizedAt?: string | Date | null;
    sealLabel?: { sealNo?: string | null; sealStatus?: string | null } | null;
    packets?: PacketRecord[];
    events?: SampleEventRecord[];
  } | null;
};

type WorkflowMilestones = {
  jobCreatedAt: string | Date;
  jobStartedAt?: string | Date | null;
  sentToAdminAt?: string | Date | null;
  sentToAdminBy?: string | null;
  adminDecisionAt?: string | Date | null;
  adminDecisionBy?: string | null;
  adminDecisionStatus?: string | null;
  operationsCompletedAt?: string | Date | null;
  handedOverToRndAt?: string | Date | null;
  handedOverToRndBy?: string | null;
  handedOverToRndTo?: string | null;
  handedOverToRndToLabel?: string | null;
};

function jsonError(error: string, details: string, status: number) {
  return NextResponse.json({ error, details }, { status });
}

function normalizeText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeDate(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildWorkflowSummary(
  job: {
    id: string;
    createdAt: string | Date;
    jobStartedAt?: string | Date | null;
    sentToAdminAt?: string | Date | null;
    sentToAdminBy?: string | null;
    adminDecisionAt?: string | Date | null;
    adminDecisionBy?: string | null;
    adminDecisionStatus?: string | null;
    operationsCompletedAt?: string | Date | null;
    handedOverToRndAt?: string | Date | null;
    handedOverToRndBy?: string | null;
    handedOverToRndTo?: string | null;
    deadline?: string | Date | null;
    lots?: WorkflowJobLot[];
    createdByUser?: PublicUser | null;
    assignedTo?: PublicUser | null;
  },
  settings: ReturnType<typeof toModuleWorkflowPolicy>,
  currentUserRole?: string,
) {
  const firstLot = job.lots?.[0] ?? null;
  const activeLot =
    job.lots?.find((lot: WorkflowJobLot) => lot.status !== "READY_FOR_RND" && lot.status !== "LOCKED") ??
    firstLot;
  const sample = activeLot?.sample ?? null;
  const packets = sample?.packets ?? [];
  const inspection = activeLot?.inspection ?? null;
  const blockers: string[] = [];

  if (!job.lots?.length) {
    blockers.push("Add at least one lot to begin workflow execution.");
  }
  if (activeLot && (!activeLot.mediaFiles?.length || !inspection)) {
    blockers.push("Capture required proof and initialize inspection before decision review.");
  }
  if (inspection?.decisionStatus !== "READY_FOR_SAMPLING") {
    blockers.push("Final decision must be passed by the configured approver before sampling.");
  }
  if (sample && !sample.homogeneousProofDone && !sample.homogenizedAt) {
    blockers.push("Homogeneous proof is still pending.");
  }
  if (sample && !sample.sealLabel?.sealNo) {
    blockers.push("Seal mapping is incomplete.");
  }
  if (packets.some((packet: PacketRecord) => !packet.packetWeight || !packet.packetUnit)) {
    blockers.push("Every packet needs weight and unit before Submit to R&D.");
  }

  const nextAction = !job.lots?.length
    ? "Add Lot"
    : !activeLot?.mediaFiles?.length
        ? "Save Images and Continue"
      : inspection?.decisionStatus !== "READY_FOR_SAMPLING"
        ? canApproveFinalDecision(currentUserRole, settings.workflow.finalDecisionApproverPolicy)
          ? "Pass / Hold / Reject"
          : "Submit for Decision"
        : !sample
          ? "Start Sampling"
          : !sample.homogeneousProofDone && !sample.homogenizedAt
            ? "Mark Homogeneous Proof"
            : packets.length === 0
              ? "Create Packets"
              : packets.some((packet: PacketRecord) => !packet.submittedToRndAt)
                ? "Submit to R&D"
                : "Workflow Complete";

  const history = [
    {
      id: `job-created-${job.id}`,
      label: "Job created",
      timestamp: job.createdAt,
      actor: job.createdByUser?.profile?.displayName ?? "System",
    },
    ...(job.lots ?? []).flatMap((lot: WorkflowJobLot) => [
      {
        id: `lot-created-${lot.id}`,
        label: `Lot ${lot.lotNumber} added`,
        timestamp: lot.createdAt,
        actor: lot.assignedBy?.profile?.displayName ?? job.createdByUser?.profile?.displayName ?? "System",
      },
      ...(lot.sample?.events ?? []).map((event: SampleEventRecord) => ({
        id: event.id,
        label: event.eventType.replaceAll("_", " "),
        timestamp: event.eventTime,
        actor: event.performedBy?.profile?.displayName ?? "System",
      })),
    ]),
  ].sort((left, right) => Number(new Date(right.timestamp)) - Number(new Date(left.timestamp)));

  return {
    workflowStage: nextAction === "Workflow Complete" ? "Submit to R&D" : nextAction,
    nextAction,
    blockers,
    images: activeLot?.mediaFiles ?? [],
    decision: inspection
      ? {
          status: inspection.decisionStatus,
          note: inspection.overallRemark,
        }
      : null,
    sample,
    sealMapping: {
      lotId: activeLot?.id ?? null,
      lotNumber: activeLot?.lotNumber ?? null,
      sealNumber: sample?.sealLabel?.sealNo ?? activeLot?.sealNumber ?? null,
      status: sample?.sealLabel?.sealStatus ?? (activeLot?.sealNumber ? "COMPLETED" : "PENDING"),
    },
    packets,
    assignment: {
      createdBy: job.createdByUser?.profile?.displayName ?? null,
      assignedTo: job.assignedTo?.profile?.displayName ?? null,
      deadline: job.deadline,
    },
    milestones: {
      jobCreatedAt: job.createdAt,
      jobStartedAt: job.jobStartedAt,
      sentToAdminAt: job.sentToAdminAt,
      sentToAdminBy: job.sentToAdminBy,
      adminDecisionAt: job.adminDecisionAt,
      adminDecisionBy: job.adminDecisionBy,
      adminDecisionStatus: job.adminDecisionStatus,
      operationsCompletedAt: job.operationsCompletedAt,
      handedOverToRndAt: job.handedOverToRndAt,
      handedOverToRndBy: job.handedOverToRndBy,
      handedOverToRndTo: job.handedOverToRndTo,
      handedOverToRndToLabel: null,
    } satisfies WorkflowMilestones,
    history,
  };
}

export async function GET(request: NextRequest, context: RouteContext<"/api/jobs/[id]/workflow">) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "READ_ONLY");
    const { id } = await context.params;

    const job = await prisma.inspectionJob.findFirst({
      where: { id, companyId: currentUser.companyId },
      select: workspaceJobSelect,
    });

    if (!job) {
      return jsonError("Not Found", "Job could not be found.", 404);
    }

    const [settingsRecord, clients, items, containerTypes, rndAssignees] = await Promise.all([
      prisma.moduleWorkflowSettings.upsert({
        where: { companyId: currentUser.companyId },
        update: {},
        create: buildModuleWorkflowSettingsCreate(currentUser.companyId),
      }),
      prisma.clientMaster.findMany({
        where: { companyId: currentUser.companyId, isActive: true },
        orderBy: { clientName: "asc" },
      }),
      prisma.itemMaster.findMany({
        where: { companyId: currentUser.companyId, isActive: true },
        orderBy: { itemName: "asc" },
      }),
      prisma.containerTypeMaster.findMany({
        where: { companyId: currentUser.companyId, isActive: true },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: {
          companyId: currentUser.companyId,
          role: "RND",
          isActive: true,
        },
        orderBy: [{ createdAt: "asc" }],
        select: {
          id: true,
          email: true,
          role: true,
          profile: {
            select: {
              displayName: true,
              companyName: true,
              avatarUrl: true,
              jobTitle: true,
            },
          },
        },
      }),
    ]);

    const settings = toModuleWorkflowPolicy(settingsRecord);
    const summary = buildWorkflowSummary(job as unknown as Parameters<typeof buildWorkflowSummary>[0], settings, currentUser.role);
    const userIds = Array.from(
      new Set(
        [
          summary.milestones.sentToAdminBy,
          summary.milestones.adminDecisionBy,
          summary.milestones.handedOverToRndBy,
          summary.milestones.handedOverToRndTo,
        ].filter((value): value is string => Boolean(value)),
      ),
    );
    const milestoneUsers = userIds.length
      ? await prisma.user.findMany({
          where: {
            companyId: currentUser.companyId,
            id: { in: userIds },
          },
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                displayName: true,
              },
            },
          },
        })
      : [];
    const userLabelMap = new Map(
      milestoneUsers.map((user) => [user.id, user.profile?.displayName ?? user.email ?? user.id]),
    );

    return NextResponse.json({
      job,
      settings,
      clients,
      items,
      containerTypes,
      rndAssignees: rndAssignees.map((user) => ({
        id: user.id,
        email: user.email,
        role: user.role,
        displayName: user.profile?.displayName ?? user.email ?? "R&D User",
      })),
      workflowStage: summary.workflowStage,
      nextAction: summary.nextAction,
      blockers: summary.blockers,
      images: summary.images,
      decision: summary.decision,
      sample: summary.sample,
      sealMapping: summary.sealMapping,
      packets: summary.packets,
      assignment: summary.assignment,
      milestones: {
        ...summary.milestones,
        sentToAdminBy: summary.milestones.sentToAdminBy ? (userLabelMap.get(summary.milestones.sentToAdminBy) ?? summary.milestones.sentToAdminBy) : null,
        adminDecisionBy: summary.milestones.adminDecisionBy ? (userLabelMap.get(summary.milestones.adminDecisionBy) ?? summary.milestones.adminDecisionBy) : null,
        handedOverToRndBy: summary.milestones.handedOverToRndBy ? (userLabelMap.get(summary.milestones.handedOverToRndBy) ?? summary.milestones.handedOverToRndBy) : null,
        handedOverToRndToLabel: summary.milestones.handedOverToRndTo ? (userLabelMap.get(summary.milestones.handedOverToRndTo) ?? null) : null,
      },
      history: summary.history,
    });
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }
    const message = error instanceof Error ? error.message : "Failed to load workflow.";
    return jsonError("System Error", message, 500);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext<"/api/jobs/[id]/workflow">) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "CREATE_JOB");
    const { id } = await context.params;
    const body = await request.json();

    const clientName = normalizeText(body?.clientName);
    const commodity = normalizeText(body?.commodity);
    const plantLocation = normalizeText(body?.plantLocation);
    const deadline = normalizeDate(body?.deadline);
    const clientId = normalizeText(body?.clientId);
    const itemId = normalizeText(body?.itemId);

    const updated = await prisma.inspectionJob.updateMany({
      where: { id, companyId: currentUser.companyId },
      data: {
        ...(clientName ? { clientName } : {}),
        ...(commodity ? { commodity } : {}),
        ...(plantLocation !== undefined ? { plantLocation } : {}),
        ...(deadline !== null ? { deadline } : {}),
        ...(clientId !== null ? { clientId } : {}),
        ...(itemId !== null ? { itemId } : {}),
      },
    });

    if (updated.count === 0) {
      return jsonError("Not Found", "Job could not be found.", 404);
    }

    const job = await prisma.inspectionJob.findFirst({
      where: { id, companyId: currentUser.companyId },
      select: workspaceJobSelect,
    });

    return NextResponse.json(job);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }
    const message = error instanceof Error ? error.message : "Failed to update workflow basics.";
    return jsonError("System Error", message, 500);
  }
}
