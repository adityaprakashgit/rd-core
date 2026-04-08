import { WorkflowEscalationStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { authorize, AuthorizationError } from "@/lib/rbac";
import { getCurrentUserFromRequest } from "@/lib/session";

function jsonError(error: string, details: string, status: number) {
  return NextResponse.json({ error, details }, { status });
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function parseStatus(value: unknown): WorkflowEscalationStatus | null {
  if (typeof value !== "string") {
    return null;
  }

  switch (value) {
    case WorkflowEscalationStatus.ACKNOWLEDGED:
      return WorkflowEscalationStatus.ACKNOWLEDGED;
    case WorkflowEscalationStatus.RESOLVED:
      return WorkflowEscalationStatus.RESOLVED;
    case WorkflowEscalationStatus.DISMISSED:
      return WorkflowEscalationStatus.DISMISSED;
    default:
      return null;
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext<"/api/admin/workflow-escalations/[id]">,
) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "MANAGE_WORKFLOW_ESCALATIONS");

    const { id } = await context.params;
    if (!id) {
      return jsonError("Validation Error", "Escalation id is required.", 400);
    }

    const body: unknown = await request.json();
    const payload = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};

    const status = parseStatus(payload.status);
    if (!status) {
      return jsonError("Validation Error", "status must be ACKNOWLEDGED, RESOLVED, or DISMISSED.", 400);
    }

    const resolutionNote = normalizeText(payload.resolutionNote);
    const assignedToUserId = normalizeText(payload.assignedToUserId);

    if (status === WorkflowEscalationStatus.RESOLVED && !resolutionNote) {
      return jsonError("Validation Error", "resolutionNote is required when resolving an escalation.", 400);
    }

    const existing = await prisma.workflowEscalation.findUnique({
      where: { id },
      select: { id: true, companyId: true },
    });

    if (!existing || existing.companyId !== currentUser.companyId) {
      return jsonError("Not Found", "Escalation not found.", 404);
    }

    if (assignedToUserId) {
      const assignee = await prisma.user.findUnique({
        where: { id: assignedToUserId },
        select: { companyId: true },
      });
      if (!assignee || assignee.companyId !== currentUser.companyId) {
        return jsonError("Validation Error", "assignedToUserId must reference a user in the same company.", 400);
      }
    }

    const updated = await prisma.workflowEscalation.update({
      where: { id: existing.id },
      data: {
        status,
        resolutionNote: resolutionNote ?? null,
        assignedToUserId: assignedToUserId ?? undefined,
        resolvedAt: status === WorkflowEscalationStatus.RESOLVED ? new Date() : null,
      },
      include: {
        raisedByUser: {
          select: {
            id: true,
            email: true,
            profile: { select: { displayName: true } },
          },
        },
        assignedToUser: {
          select: {
            id: true,
            email: true,
            profile: { select: { displayName: true } },
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }

    const message = error instanceof Error ? error.message : "Failed to update escalation.";
    return jsonError("System Error", message, 500);
  }
}
