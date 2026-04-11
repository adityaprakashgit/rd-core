import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthorizationError, authorize } from "@/lib/rbac";
import { loadRndLineageLinkage } from "@/lib/rnd-report-linkage";
import { defaultPacketUsageBalance, derivePacketUsageBalance } from "@/lib/rnd-ledger";
import { rndJobDetailSelect } from "@/lib/rnd-job-select";
import { resolveSuggestedRndAssigneeId, searchRndUsers } from "@/lib/rnd-user-picker";
import { nextActionForStatus, statusStepLabel } from "@/lib/rnd-workflow";
import { getCurrentUserFromRequest } from "@/lib/session";

function jsonError(error: string, details: string, status: number) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "READ_ONLY");

    const { id } = await context.params;
    const job = await prisma.rndJob.findFirst({
      where: { id, companyId: currentUser.companyId },
      select: rndJobDetailSelect,
    });

    if (!job) {
      return jsonError("Not Found", "R&D job was not found.", 404);
    }

    const blockers: string[] = [];
    if (!job.packetUse) blockers.push("packet use not selected");
    if (!job.testType) blockers.push("test type not chosen");

    const packetSeed = Number(job.packet.packetWeight ?? job.packet.packetQuantity ?? 0);
    const balance = job.packet
      ? derivePacketUsageBalance(job.packetUsageLedgerEntries, Number.isFinite(packetSeed) ? packetSeed : 0)
      : defaultPacketUsageBalance();

    const [assigneeOptions, approverOptions, suggestedAssigneeId, reportLinkage] = await Promise.all([
      searchRndUsers({
        prismaClient: prisma,
        companyId: currentUser.companyId,
        roles: ["RND"],
        query: null,
        limit: 20,
      }),
      searchRndUsers({
        prismaClient: prisma,
        companyId: currentUser.companyId,
        roles: ["ADMIN", "RND"],
        query: null,
        limit: 20,
      }),
      resolveSuggestedRndAssigneeId({
        prismaClient: prisma,
        companyId: currentUser.companyId,
        parentJobId: job.parentJobId,
        handoverTargetId: job.parentJob.handedOverToRndTo,
      }),
      loadRndLineageLinkage(prisma, {
        companyId: currentUser.companyId,
        parentJobId: job.parentJobId,
        sampleId: job.sampleId,
      }),
    ]);

    return NextResponse.json({
      job,
      currentStep: statusStepLabel(job.status),
      nextAction: nextActionForStatus(job.status),
      blockers,
      pickerOptions: {
        assignees: assigneeOptions,
        approvers: approverOptions,
        suggestedAssigneeId: suggestedAssigneeId ?? null,
      },
      ledger: {
        balance,
      },
      reportLinkage: {
        activeResult: reportLinkage.activeResult,
        supersededResults: reportLinkage.supersededResults,
        activeReport: reportLinkage.activeReport,
        previousReports: reportLinkage.previousReports,
        defaultReportUrl: reportLinkage.defaultReportUrl,
        defaultCoaUrl: reportLinkage.defaultCoaUrl,
      },
    });
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }
    const message = error instanceof Error ? error.message : "Failed to fetch R&D job.";
    return jsonError("System Error", message, 500);
  }
}
