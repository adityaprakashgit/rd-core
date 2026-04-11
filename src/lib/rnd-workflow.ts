import type { Prisma } from "@prisma/client";
import { RndJobStatus, RndReviewAction } from "@prisma/client";

export const RND_PACKET_USE_OPTIONS = [
  "TESTING",
  "RETAIN",
  "BACKUP",
  "REFERENCE",
  "CLIENT_RETEST",
  "ADDITIONAL_ANALYSIS",
] as const;

export type RndPacketUse = (typeof RND_PACKET_USE_OPTIONS)[number];

export const RND_PRIORITY_OPTIONS = ["HIGH", "MEDIUM", "LOW"] as const;
export type RndPriority = (typeof RND_PRIORITY_OPTIONS)[number];

export const RND_QUEUE_BUCKETS = [
  "PENDING_INTAKE",
  "READY_FOR_SETUP",
  "IN_TESTING",
  "AWAITING_REVIEW",
  "COMPLETED",
] as const;

export type RndQueueBucket = (typeof RND_QUEUE_BUCKETS)[number];

export function normalizePacketUse(value: unknown): RndPacketUse | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/gu, "_");
  return (RND_PACKET_USE_OPTIONS as readonly string[]).includes(normalized)
    ? (normalized as RndPacketUse)
    : null;
}

export function normalizePriority(value: unknown): RndPriority {
  if (typeof value !== "string") return "MEDIUM";
  const normalized = value.trim().toUpperCase();
  if (normalized === "HIGH" || normalized === "MEDIUM" || normalized === "LOW") {
    return normalized;
  }
  return "MEDIUM";
}

export function toRndQueueBucket(status: RndJobStatus): RndQueueBucket {
  if (status === RndJobStatus.CREATED) return "PENDING_INTAKE";
  if (status === RndJobStatus.READY_FOR_TEST_SETUP) return "READY_FOR_SETUP";
  if (
    status === RndJobStatus.READY_FOR_TESTING ||
    status === RndJobStatus.IN_TESTING ||
    status === RndJobStatus.REWORK_REQUIRED
  ) {
    return "IN_TESTING";
  }
  if (status === RndJobStatus.AWAITING_REVIEW) return "AWAITING_REVIEW";
  return "COMPLETED";
}

export function dueStatus(deadline: Date | string | null | undefined): "ON_TRACK" | "DUE_SOON" | "OVERDUE" {
  if (!deadline) return "ON_TRACK";
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return "ON_TRACK";
  const now = Date.now();
  const diffMs = date.getTime() - now;
  if (diffMs < 0) return "OVERDUE";
  if (diffMs <= 24 * 60 * 60 * 1000) return "DUE_SOON";
  return "ON_TRACK";
}

export function nextActionForStatus(status: RndJobStatus): string {
  switch (status) {
    case RndJobStatus.CREATED:
      return "Accept Job";
    case RndJobStatus.READY_FOR_TEST_SETUP:
      return "Start Setup";
    case RndJobStatus.READY_FOR_TESTING:
      return "Start Testing";
    case RndJobStatus.IN_TESTING:
      return "Enter Results";
    case RndJobStatus.AWAITING_REVIEW:
      return "Review";
    case RndJobStatus.APPROVED:
      return "Finalize Output";
    case RndJobStatus.REWORK_REQUIRED:
      return "Start Testing";
    case RndJobStatus.COMPLETED:
    default:
      return "View History";
  }
}

export function statusStepLabel(status: RndJobStatus): string {
  switch (status) {
    case RndJobStatus.CREATED:
      return "Pending Intake";
    case RndJobStatus.READY_FOR_TEST_SETUP:
      return "Ready for Setup";
    case RndJobStatus.READY_FOR_TESTING:
      return "Ready for Testing";
    case RndJobStatus.IN_TESTING:
      return "In Testing";
    case RndJobStatus.AWAITING_REVIEW:
      return "Awaiting Review";
    case RndJobStatus.APPROVED:
      return "Approved";
    case RndJobStatus.REWORK_REQUIRED:
      return "Rework Required";
    case RndJobStatus.COMPLETED:
    default:
      return "Completed";
  }
}

const TRANSITIONS: Record<RndJobStatus, readonly RndJobStatus[]> = {
  [RndJobStatus.CREATED]: [RndJobStatus.READY_FOR_TEST_SETUP],
  [RndJobStatus.READY_FOR_TEST_SETUP]: [RndJobStatus.READY_FOR_TESTING],
  [RndJobStatus.READY_FOR_TESTING]: [RndJobStatus.IN_TESTING],
  [RndJobStatus.IN_TESTING]: [RndJobStatus.AWAITING_REVIEW],
  [RndJobStatus.AWAITING_REVIEW]: [RndJobStatus.APPROVED, RndJobStatus.REWORK_REQUIRED],
  [RndJobStatus.APPROVED]: [RndJobStatus.COMPLETED],
  [RndJobStatus.REWORK_REQUIRED]: [RndJobStatus.READY_FOR_TESTING],
  [RndJobStatus.COMPLETED]: [],
};

export function canTransition(current: RndJobStatus, next: RndJobStatus) {
  return TRANSITIONS[current].includes(next);
}

export function reviewActionToStatus(action: RndReviewAction): RndJobStatus {
  switch (action) {
    case RndReviewAction.APPROVE:
      return RndJobStatus.APPROVED;
    case RndReviewAction.REWORK:
    case RndReviewAction.REJECT:
      return RndJobStatus.REWORK_REQUIRED;
  }
}

export async function generateRndJobNumber(
  tx: Prisma.TransactionClient,
  companyId: string,
  at: Date,
): Promise<string> {
  const year = at.getUTCFullYear();
  const prefix = `RND-${year}-`;
  const last = await tx.rndJob.findFirst({
    where: {
      companyId,
      rndJobNumber: { startsWith: prefix },
    },
    orderBy: { rndJobNumber: "desc" },
    select: { rndJobNumber: true },
  });

  const lastSeq = Number(last?.rndJobNumber.split("-").at(-1) ?? "0");
  const seq = Number.isFinite(lastSeq) ? lastSeq + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export function canMutateRndJob(input: {
  role: string;
  assignedToId?: string | null;
  approverUserId?: string | null;
  currentUserId: string;
  mode: "setup" | "testing" | "review";
}) {
  const role = input.role.toUpperCase();
  if (role === "ADMIN") return true;

  if (input.mode === "review") {
    if (role !== "RND") return false;
    return Boolean(input.currentUserId && input.currentUserId === input.approverUserId);
  }

  if (role !== "RND") return false;
  return Boolean(input.currentUserId && input.currentUserId === input.assignedToId);
}

export function queueSortPriority(input: {
  status: RndJobStatus;
  due: "ON_TRACK" | "DUE_SOON" | "OVERDUE";
  receivedAt: Date | string;
}) {
  const overdueRank = input.due === "OVERDUE" ? 0 : 1;
  const statusRank =
    input.status === RndJobStatus.AWAITING_REVIEW
      ? 0
      : input.status === RndJobStatus.READY_FOR_TESTING ||
          input.status === RndJobStatus.IN_TESTING ||
          input.status === RndJobStatus.REWORK_REQUIRED
        ? 1
        : input.status === RndJobStatus.CREATED || input.status === RndJobStatus.READY_FOR_TEST_SETUP
          ? 2
          : 3;
  return {
    overdueRank,
    statusRank,
    ts: Number(new Date(input.receivedAt)),
  };
}
