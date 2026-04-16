import { NextRequest, NextResponse } from "next/server";

import {
  buildModuleWorkflowSettingsCreate,
  toModuleWorkflowPolicy,
} from "@/lib/module-workflow-policy";
import { prisma } from "@/lib/prisma";
import { authorize, AuthorizationError } from "@/lib/rbac";
import { getCurrentUserFromRequest } from "@/lib/session";
import { workspaceJobSelect } from "@/lib/job-workspace";
import { buildWorkflowSummary } from "@/lib/job-workflow-summary";

type JobWorkflowRouteContext = {
  params: Promise<{ id: string }>;
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

export async function GET(request: NextRequest, context: JobWorkflowRouteContext) {
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

export async function PATCH(request: NextRequest, context: JobWorkflowRouteContext) {
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
