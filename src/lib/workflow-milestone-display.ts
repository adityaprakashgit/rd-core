import type { InspectionJob } from "@/types/inspection";

export type WorkflowMilestoneLabel =
  | "Batch Created"
  | "Batch Started"
  | "Sent to Admin"
  | "Admin Decision"
  | "Operations Completed"
  | "Handed Over to R&D";

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatMilestoneTimestamp(value: string | Date | null | undefined): string {
  const parsed = toDate(value);
  return parsed ? parsed.toLocaleString() : "Not Available";
}

export function formatHoursDuration(hours: number): string {
  if (hours < 24) {
    return `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remainder = hours % 24;
  return remainder > 0 ? `${days}d ${remainder}h` : `${days}d`;
}

export function diffHours(from: string | Date | null | undefined, to?: string | Date | null | undefined): number | null {
  const start = toDate(from);
  const end = toDate(to ?? new Date());
  if (!start || !end) {
    return null;
  }
  return Math.max(Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60)), 0);
}

export function getCurrentMilestoneStage(job: InspectionJob): WorkflowMilestoneLabel {
  if (!job.jobStartedAt) return "Batch Created";
  if (!job.sentToAdminAt) return "Batch Started";
  if (!job.adminDecisionAt) return "Sent to Admin";
  if (!job.operationsCompletedAt) return "Admin Decision";
  if (!job.handedOverToRndAt) return "Operations Completed";
  return "Handed Over to R&D";
}

export function getCurrentMilestoneAgeHours(job: InspectionJob): number | null {
  switch (getCurrentMilestoneStage(job)) {
    case "Batch Created":
      return diffHours(job.createdAt);
    case "Batch Started":
      return diffHours(job.jobStartedAt);
    case "Sent to Admin":
      return diffHours(job.sentToAdminAt);
    case "Admin Decision":
      return diffHours(job.adminDecisionAt);
    case "Operations Completed":
      return diffHours(job.operationsCompletedAt);
    case "Handed Over to R&D":
      return diffHours(job.handedOverToRndAt, job.handedOverToRndAt);
    default:
      return null;
  }
}

export function getMilestoneHealthRows(job: InspectionJob) {
  return [
    { label: "Batch Created" as const, at: job.createdAt },
    { label: "Batch Started" as const, at: job.jobStartedAt },
    { label: "Sent to Admin" as const, at: job.sentToAdminAt },
    { label: "Admin Decision" as const, at: job.adminDecisionAt },
    { label: "Operations Completed" as const, at: job.operationsCompletedAt },
    { label: "Handed Over to R&D" as const, at: job.handedOverToRndAt },
  ];
}
