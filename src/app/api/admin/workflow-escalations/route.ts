import {
  WorkflowEscalationStatus,
  WorkflowEscalationType,
} from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { authorize, AuthorizationError } from "@/lib/rbac";
import { getCurrentUserFromRequest } from "@/lib/session";

export const dynamic = "force-dynamic";

function jsonError(error: string, details: string, status: number) {
  return NextResponse.json({ error, details }, { status });
}

function parseStatus(value: string | null): WorkflowEscalationStatus | null {
  if (!value) {
    return null;
  }
  return (Object.values(WorkflowEscalationStatus) as string[]).includes(value)
    ? (value as WorkflowEscalationStatus)
    : null;
}

function parseType(value: string | null): WorkflowEscalationType | null {
  if (!value) {
    return null;
  }
  return (Object.values(WorkflowEscalationType) as string[]).includes(value)
    ? (value as WorkflowEscalationType)
    : null;
}

function parseIntWithDefault(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "MANAGE_WORKFLOW_ESCALATIONS");

    const status = parseStatus(request.nextUrl.searchParams.get("status"));
    const type = parseType(request.nextUrl.searchParams.get("type"));
    const jobId = request.nextUrl.searchParams.get("jobId")?.trim() || null;
    const lotId = request.nextUrl.searchParams.get("lotId")?.trim() || null;
    const page = parseIntWithDefault(request.nextUrl.searchParams.get("page"), 1);
    const pageSize = Math.min(parseIntWithDefault(request.nextUrl.searchParams.get("pageSize"), 20), 100);
    const skip = (page - 1) * pageSize;

    const where = {
      companyId: currentUser.companyId,
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(jobId ? { jobId } : {}),
      ...(lotId ? { lotId } : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.workflowEscalation.count({ where }),
      prisma.workflowEscalation.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: {
          raisedByUser: {
            select: {
              id: true,
              email: true,
              profile: {
                select: {
                  displayName: true,
                },
              },
            },
          },
          assignedToUser: {
            select: {
              id: true,
              email: true,
              profile: {
                select: {
                  displayName: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      rows,
      page,
      pageSize,
      total,
      totalPages: Math.max(Math.ceil(total / pageSize), 1),
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }

    const message = error instanceof Error ? error.message : "Failed to fetch escalation queue.";
    return jsonError("System Error", message, 500);
  }
}
