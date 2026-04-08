import {
  WorkflowEscalationSeverity,
  WorkflowEscalationType,
} from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { createWorkflowEscalation } from "@/lib/workflow-escalation";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";

export const dynamic = "force-dynamic";

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

function parseType(value: unknown): WorkflowEscalationType | null {
  if (typeof value !== "string") {
    return null;
  }
  return (Object.values(WorkflowEscalationType) as string[]).includes(value)
    ? (value as WorkflowEscalationType)
    : null;
}

function parseSeverity(value: unknown): WorkflowEscalationSeverity {
  if (typeof value !== "string") {
    return WorkflowEscalationSeverity.MEDIUM;
  }
  return (Object.values(WorkflowEscalationSeverity) as string[]).includes(value)
    ? (value as WorkflowEscalationSeverity)
    : WorkflowEscalationSeverity.MEDIUM;
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    const body: unknown = await request.json();
    const payload = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};

    const type = parseType(payload.type);
    const severity = parseSeverity(payload.severity);
    const title = normalizeText(payload.title);
    const jobId = normalizeText(payload.jobId);
    const lotId = normalizeText(payload.lotId);
    const overrideReason = normalizeText(payload.overrideReason);

    if (!type || !title) {
      return jsonError("Validation Error", "type and title are required.", 400);
    }

    if (jobId) {
      const job = await prisma.inspectionJob.findUnique({
        where: { id: jobId },
        select: { companyId: true },
      });
      if (!job || job.companyId !== currentUser.companyId) {
        return jsonError("Forbidden", "Invalid job scope.", 403);
      }
    }

    if (lotId) {
      const lot = await prisma.inspectionLot.findUnique({
        where: { id: lotId },
        select: { companyId: true },
      });
      if (!lot || lot.companyId !== currentUser.companyId) {
        return jsonError("Forbidden", "Invalid lot scope.", 403);
      }
    }

    const escalation = await createWorkflowEscalation({
      companyId: currentUser.companyId,
      type,
      severity,
      title,
      detailsJson: payload.detailsJson,
      overrideReason,
      jobId,
      lotId,
      raisedByUserId: currentUser.id,
    });

    return NextResponse.json(escalation, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create workflow escalation.";
    return jsonError("System Error", message, 500);
  }
}
