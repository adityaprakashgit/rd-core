import { RndJobType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { AuthorizationError, authorize } from "@/lib/rbac";
import { derivePacketUsageBalance, isLedgerAllocationEligible, normalizeLedgerQuantity, normalizePacketUnit } from "@/lib/rnd-ledger";
import { rndJobListSelect } from "@/lib/rnd-job-select";
import {
  dueStatus,
  generateRndJobNumber,
  nextActionForStatus,
  normalizePacketUse,
  queueSortPriority,
  statusStepLabel,
  toRndQueueBucket,
} from "@/lib/rnd-workflow";
import { getCurrentUserFromRequest } from "@/lib/session";

function jsonError(error: string, details: string, status: number) {
  return NextResponse.json({ error, details }, { status });
}

function parseDate(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "READ_ONLY");

    const qp = request.nextUrl.searchParams;
    const bucket = qp.get("bucket");
    const status = qp.get("status");
    const priority = qp.get("priority");
    const lotNumber = qp.get("lotNumber");
    const parentJobNumber = qp.get("parentJobNumber");
    const packetId = qp.get("packetId");
    const sampleId = qp.get("sampleId");
    const packetUse = qp.get("packetUse");
    const jobType = qp.get("jobType");
    const assignedUser = qp.get("assignedUser");
    const dateFrom = parseDate(qp.get("dateFrom"));
    const dateTo = parseDate(qp.get("dateTo"));

    const rows = await prisma.rndJob.findMany({
      where: {
        companyId: currentUser.companyId,
        ...(status ? { status: status as never } : {}),
        ...(priority ? { priority: priority.toUpperCase() } : {}),
        ...(packetUse ? { packetUse: normalizePacketUse(packetUse) ?? undefined } : {}),
        ...(jobType ? { jobType: jobType as RndJobType } : {}),
        ...(assignedUser ? { assignedToId: assignedUser } : {}),
        ...(dateFrom || dateTo
          ? {
              receivedAt: {
                ...(dateFrom ? { gte: dateFrom } : {}),
                ...(dateTo ? { lte: dateTo } : {}),
              },
            }
          : {}),
        ...(lotNumber
          ? {
              lot: {
                lotNumber: { contains: lotNumber, mode: "insensitive" },
              },
            }
          : {}),
        ...(parentJobNumber
          ? {
              parentJob: {
                inspectionSerialNumber: { contains: parentJobNumber, mode: "insensitive" },
              },
            }
          : {}),
        ...(packetId
          ? {
              packet: {
                packetCode: { contains: packetId, mode: "insensitive" },
              },
            }
          : {}),
        ...(sampleId
          ? {
              sample: {
                sampleCode: { contains: sampleId, mode: "insensitive" },
              },
            }
          : {}),
      },
      select: rndJobListSelect,
      take: 500,
    });

    const mapped = rows
      .map((row) => {
        const due = dueStatus(row.deadline);
        const bucketValue = toRndQueueBucket(row.status);
        return {
          ...row,
          bucket: bucketValue,
          dueStatus: due,
          currentStep: statusStepLabel(row.status),
          primaryAction: nextActionForStatus(row.status),
          sortKey: queueSortPriority({ status: row.status, due, receivedAt: row.receivedAt }),
        };
      })
      .filter((row) => !bucket || row.bucket === bucket)
      .sort((a, b) => {
        if (a.sortKey.overdueRank !== b.sortKey.overdueRank) return a.sortKey.overdueRank - b.sortKey.overdueRank;
        if (a.sortKey.statusRank !== b.sortKey.statusRank) return a.sortKey.statusRank - b.sortKey.statusRank;
        return b.sortKey.ts - a.sortKey.ts;
      });

    return NextResponse.json({
      rows: mapped,
      summary: {
        total: mapped.length,
        pendingIntake: mapped.filter((row) => row.bucket === "PENDING_INTAKE").length,
        readyForSetup: mapped.filter((row) => row.bucket === "READY_FOR_SETUP").length,
        inTesting: mapped.filter((row) => row.bucket === "IN_TESTING").length,
        awaitingReview: mapped.filter((row) => row.bucket === "AWAITING_REVIEW").length,
        completed: mapped.filter((row) => row.bucket === "COMPLETED").length,
      },
    });
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }
    const message = error instanceof Error ? error.message : "Failed to fetch R&D jobs.";
    return jsonError("System Error", message, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "MUTATE_RND");

    const body = await request.json();
    const previousRndJobIdRaw =
      typeof body?.sourceRndJobId === "string"
        ? body.sourceRndJobId.trim()
        : typeof body?.previousRndJobId === "string"
          ? body.previousRndJobId.trim()
          : "";
    if (!previousRndJobIdRaw) return jsonError("Validation Error", "sourceRndJobId is required.", 400);

    const packetId = typeof body?.packetId === "string" ? body.packetId.trim() : "";
    if (!packetId) return jsonError("Validation Error", "packetId is required.", 400);

    const requestedQty = normalizeLedgerQuantity(body?.requestedQty);
    if (!requestedQty) return jsonError("Validation Error", "requestedQty must be greater than zero.", 400);

    const useType = normalizePacketUse(body?.useType);
    if (!useType) return jsonError("Validation Error", "useType is invalid.", 400);

    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    if (!reason) return jsonError("Validation Error", "reason is required.", 400);

    const created = await prisma.$transaction(async (tx) => {
      const previous = await tx.rndJob.findFirst({
        where: { id: previousRndJobIdRaw, companyId: currentUser.companyId },
      });

      if (!previous) {
        throw new Error("RND_JOB_NOT_FOUND");
      }

      if (!["APPROVED", "COMPLETED"].includes(previous.status)) {
        throw new Error("RETEST_REQUIRES_COMPLETED");
      }

      const packet = await tx.packet.findFirst({
        where: { id: packetId, companyId: currentUser.companyId },
        select: {
          id: true,
          jobId: true,
          lotId: true,
          sampleId: true,
          packetUnit: true,
          packetStatus: true,
          packetWeight: true,
          packetQuantity: true,
          usageLedgerEntries: {
            orderBy: { createdAt: "asc" },
            select: {
              entryType: true,
              useType: true,
              quantity: true,
              direction: true,
            },
          },
        },
      });
      if (!packet) throw new Error("PACKET_NOT_FOUND");
      if (packet.jobId !== previous.parentJobId) throw new Error("PACKET_PARENT_MISMATCH");

      const seed = Number(packet.packetWeight ?? packet.packetQuantity ?? 0);
      const balance = derivePacketUsageBalance(packet.usageLedgerEntries, Number.isFinite(seed) ? seed : 0);
      const unit = normalizePacketUnit(packet.packetUnit);
      const eligibility = isLedgerAllocationEligible({
        requestedQty,
        requestedUnit: unit,
        packetUnit: packet.packetUnit,
        packetStatus: packet.packetStatus,
        balance,
      });
      if (!eligibility.ok) throw new Error(`LEDGER_BLOCK_${eligibility.reason}`);

      const receivedAt = new Date();
      const rndJobNumber = await generateRndJobNumber(tx, currentUser.companyId, receivedAt);
      const jobType = body?.jobType === "CLIENT_REQUESTED_RETEST" ? RndJobType.CLIENT_REQUESTED_RETEST : RndJobType.RETEST;

      const next = await tx.rndJob.create({
        data: {
          rndJobNumber,
          companyId: currentUser.companyId,
          parentJobId: previous.parentJobId,
          lotId: packet.lotId,
          sampleId: packet.sampleId,
          packetId: packet.id,
          previousRndJobId: previous.id,
          status: "CREATED",
          jobType,
          packetUse: useType,
          priority: previous.priority,
          deadline: previous.deadline,
          assignedToId: previous.assignedToId,
          approverUserId: previous.approverUserId,
          remarks: reason,
          receivedAt,
        },
        select: rndJobListSelect,
      });

      await tx.packetUsageLedger.create({
        data: {
          companyId: currentUser.companyId,
          packetId: packet.id,
          rndJobId: next.id,
          entryType: "ALLOCATE",
          useType,
          quantity: requestedQty,
          unit,
          direction: "OUT",
          notes: reason,
          createdById: currentUser.id,
        },
      });

      await recordAuditLog(tx, {
        jobId: previous.parentJobId,
        userId: currentUser.id,
        entity: "RND_JOB",
        action: "RND_RETEST_CREATED",
        metadata: {
          previousRndJobId: previous.id,
          rndJobId: next.id,
          rndJobNumber: next.rndJobNumber,
          packetId: packet.id,
          requestedQty,
          useType,
        },
      });

      return next;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }
    if (error instanceof Error && error.message === "RND_JOB_NOT_FOUND") {
      return jsonError("Not Found", "R&D Job not found.", 404);
    }
    if (error instanceof Error && error.message === "RETEST_REQUIRES_COMPLETED") {
      return jsonError("Workflow Error", "Retest can be created only from approved/completed jobs.", 422);
    }
    if (error instanceof Error && error.message === "PACKET_NOT_FOUND") {
      return jsonError("Not Found", "Packet not found.", 404);
    }
    if (error instanceof Error && error.message === "PACKET_PARENT_MISMATCH") {
      return jsonError("Validation Error", "Retest packet must belong to the same parent job.", 422);
    }
    if (error instanceof Error && error.message.startsWith("LEDGER_BLOCK_")) {
      return jsonError("Workflow Error", error.message.replace("LEDGER_BLOCK_", ""), 422);
    }
    const message = error instanceof Error ? error.message : "Failed to create retest job.";
    return jsonError("System Error", message, 500);
  }
}
