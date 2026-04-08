import type {
  AuditLog,
  InspectionChecklistItem,
  InspectionChecklistResponse,
  InspectionDecisionStatus,
  InspectionIssue,
  InspectionJob,
  InspectionLot,
  InspectionMediaCategory,
  InspectionMediaFile,
} from "@/types/inspection";
import {
  BASE_REQUIRED_INSPECTION_MEDIA,
  buildDecisionValidation,
  deriveInspectionAssessment,
  getResponseOptions,
  getResponseTypeOptions,
  INSPECTION_MEDIA_LABELS,
  INSPECTION_SECTION_ORDER,
} from "@/lib/inspection-checklist";
import { getLotIntakeStatusPresentation, getLotMediaFiles } from "@/lib/intake-workflow";

export const REVIEW_SECTION_ID = "review";
export const REVIEW_SECTION_NAME = "Review & Decision";

export type InspectionResponseDraftMap = Record<string, { responseValue: string; responseText: string }>;
export type InspectionIssueDraft = Pick<InspectionIssue, "issueCategory" | "severity" | "description" | "status">;

export type InspectionSectionViewModel = {
  id: string;
  sectionName: string;
  items: InspectionChecklistItem[];
  isReview: boolean;
};

export type InspectionLotStatusPresentation = {
  status: string;
  label: string;
  tone: "gray" | "orange" | "blue" | "purple" | "teal" | "green" | "red";
  summary: string;
};

export function buildInspectionSections(items: InspectionChecklistItem[]): InspectionSectionViewModel[] {
  const grouped = INSPECTION_SECTION_ORDER.map((sectionName) => ({
    id: sectionName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    sectionName,
    items: items
      .filter((item) => item.sectionName === sectionName)
      .sort((left, right) => left.displayOrder - right.displayOrder),
    isReview: false,
  })).filter((group) => group.items.length > 0);

  return [
    ...grouped,
    {
      id: REVIEW_SECTION_ID,
      sectionName: REVIEW_SECTION_NAME,
      items: [],
      isReview: true,
    },
  ];
}

export function buildAssessmentResponses(
  checklistItems: InspectionChecklistItem[],
  responseDrafts: InspectionResponseDraftMap,
  isExceptionResponse: (itemKey: string, responseValue: string | null | undefined, responseType?: string | null) => boolean,
): InspectionChecklistResponse[] {
  return checklistItems.map((item) => ({
    id: `draft-${item.id}`,
    inspectionId: "draft",
    checklistItemMasterId: item.id,
    sectionName: item.sectionName,
    itemLabel: item.itemLabel,
    responseValue: responseDrafts[item.id]?.responseValue || null,
    responseText: responseDrafts[item.id]?.responseText || null,
    isException: isExceptionResponse(item.itemKey, responseDrafts[item.id]?.responseValue, item.responseType),
    displayOrder: item.displayOrder,
    recordedAt: new Date().toISOString(),
  }));
}

export function getSectionProgress(
  section: Pick<InspectionSectionViewModel, "items">,
  responseDrafts: InspectionResponseDraftMap,
) {
  const answered = section.items.filter((item) => Boolean(responseDrafts[item.id]?.responseValue?.trim())).length;
  const required = section.items.filter((item) => item.isRequired).length;
  const completedRequired = section.items.filter(
    (item) => item.isRequired && Boolean(responseDrafts[item.id]?.responseValue?.trim()),
  ).length;

  return {
    answered,
    total: section.items.length,
    required,
    completedRequired,
    isComplete: required > 0 && completedRequired === required,
  };
}

export function getChecklistProgress(
  items: InspectionChecklistItem[],
  responseDrafts: InspectionResponseDraftMap,
) {
  const required = items.filter((item) => item.isRequired).length;
  const completedRequired = items.filter(
    (item) => item.isRequired && Boolean(responseDrafts[item.id]?.responseValue?.trim()),
  ).length;

  return {
    required,
    completedRequired,
    remainingRequired: Math.max(required - completedRequired, 0),
  };
}

export function getIssueDraftValidationErrors(issues: InspectionIssueDraft[]): string[] {
  const errors: string[] = [];

  issues.forEach((issue, index) => {
    if (!issue.issueCategory?.trim()) {
      errors.push(`Issue ${index + 1}: category is required.`);
    }
    if (!issue.severity?.trim()) {
      errors.push(`Issue ${index + 1}: severity is required.`);
    }
    if (!issue.description?.trim()) {
      errors.push(`Issue ${index + 1}: description is required.`);
    }
  });

  return errors;
}

export function getDecisionValidationErrors(input: {
  decisionStatus: InspectionDecisionStatus;
  assessment: ReturnType<typeof deriveInspectionAssessment>;
  issues: InspectionIssueDraft[];
  overallRemark?: string | null;
}) {
  const issueErrors = getIssueDraftValidationErrors(input.issues);
  const decisionErrors = buildDecisionValidation({
    decisionStatus: input.decisionStatus,
    assessment: input.assessment,
    issues: input.issues.map((issue, index) => ({
      id: `draft-${index}`,
      inspectionId: "draft",
      issueCategory: issue.issueCategory,
      severity: issue.severity,
      description: issue.description,
      status: issue.status,
      createdAt: new Date().toISOString(),
    })),
    overallRemark: input.overallRemark,
  });

  return [...issueErrors, ...decisionErrors];
}

export function getDecisionEnablement(input: {
  assessment: ReturnType<typeof deriveInspectionAssessment>;
  issues: InspectionIssueDraft[];
  overallRemark?: string | null;
}) {
  return {
    passErrors: getDecisionValidationErrors({
      decisionStatus: "READY_FOR_SAMPLING",
      assessment: input.assessment,
      issues: input.issues,
      overallRemark: input.overallRemark,
    }),
    holdErrors: getDecisionValidationErrors({
      decisionStatus: "ON_HOLD",
      assessment: input.assessment,
      issues: input.issues,
      overallRemark: input.overallRemark,
    }),
    rejectErrors: getDecisionValidationErrors({
      decisionStatus: "REJECTED",
      assessment: input.assessment,
      issues: input.issues,
      overallRemark: input.overallRemark,
    }),
  };
}

export function sortRequiredMediaCategories(categories: InspectionMediaCategory[]): InspectionMediaCategory[] {
  const seen = new Set<InspectionMediaCategory>();
  const ordered: InspectionMediaCategory[] = [];

  for (const category of BASE_REQUIRED_INSPECTION_MEDIA) {
    if (categories.includes(category) && !seen.has(category)) {
      ordered.push(category);
      seen.add(category);
    }
  }

  for (const category of categories) {
    if (!seen.has(category)) {
      ordered.push(category);
      seen.add(category);
    }
  }

  return ordered;
}

export function getRequiredMediaCards(categories: InspectionMediaCategory[]) {
  return sortRequiredMediaCategories(categories).map((category) => ({
    category,
    label: INSPECTION_MEDIA_LABELS[category] ?? category,
    isDefault: BASE_REQUIRED_INSPECTION_MEDIA.includes(category),
  }));
}

export function getLotInspectionStatusPresentation(lot: InspectionLot | null | undefined): InspectionLotStatusPresentation {
  const status = lot?.status ?? "CREATED";

  switch (status) {
    case "READY_FOR_SAMPLING":
      return {
        status,
        label: "Ready for sampling",
        tone: "green",
        summary: "Inspection passed and sampling can begin.",
      };
    case "ON_HOLD":
      return {
        status,
        label: "On hold",
        tone: "orange",
        summary: "Inspection found issues that require review.",
      };
    case "REJECTED":
      return {
        status,
        label: "Rejected",
        tone: "red",
        summary: "Inspection blocked the lot from moving forward.",
      };
    case "INSPECTION_IN_PROGRESS":
      return {
        status,
        label: "Inspection in progress",
        tone: "orange",
        summary: "Checklist, proof capture, and issue review are active.",
      };
    case "COMPLETED":
      return {
        status,
        label: "Sampling completed",
        tone: "green",
        summary: "Sampling evidence is complete for this lot.",
      };
    default: {
      const fallback = getLotIntakeStatusPresentation(lot);
      if (status === "READY_FOR_NEXT_STAGE") {
        return {
          status,
          label: "Ready to inspect",
          tone: "teal",
          summary: "Lot intake is complete and inspection can start.",
        };
      }

      return {
        status,
        label: fallback.label,
        tone: fallback.tone,
        summary: "Lot intake is still being prepared for inspection.",
      };
    }
  }
}

export function summarizeInspectionLots(job: InspectionJob) {
  const lots = job.lots ?? [];
  return {
    total: lots.length,
    ready: lots.filter((lot) => lot.status === "READY_FOR_SAMPLING").length,
    inProgress: lots.filter((lot) => lot.status === "INSPECTION_IN_PROGRESS").length,
    onHold: lots.filter((lot) => lot.status === "ON_HOLD").length,
    rejected: lots.filter((lot) => lot.status === "REJECTED").length,
    pending: lots.filter(
      (lot) =>
        !["INSPECTION_IN_PROGRESS", "READY_FOR_SAMPLING", "ON_HOLD", "REJECTED", "COMPLETED"].includes(lot.status ?? ""),
    ).length,
  };
}

function getLotQueuePriority(lot: InspectionLot) {
  switch (lot.status) {
    case "INSPECTION_IN_PROGRESS":
      return 0;
    case "ON_HOLD":
      return 1;
    case "READY_FOR_NEXT_STAGE":
      return 2;
    case "READY_FOR_SAMPLING":
      return 4;
    case "COMPLETED":
      return 5;
    case "REJECTED":
      return 6;
    default:
      return 3;
  }
}

function getTimestampValue(value: string | Date | null | undefined) {
  if (!value) {
    return 0;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function sortInspectionLotsForQueue(lots: InspectionLot[]) {
  return [...lots].sort((left, right) => {
    const priorityDelta = getLotQueuePriority(left) - getLotQueuePriority(right);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    return getTimestampValue(right.updatedAt ?? right.createdAt) - getTimestampValue(left.updatedAt ?? left.createdAt);
  });
}

export function getInspectionQueueEvidenceFiles(lot: InspectionLot | null | undefined): InspectionMediaFile[] {
  const files = [...getLotMediaFiles(lot), ...(lot?.inspection?.mediaFiles ?? [])];
  const seen = new Set<string>();

  return files.filter((file) => {
    const key = `${file.category}:${file.storageKey}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function getLotInspectionIssueSummary(lot: InspectionLot | null | undefined) {
  const issues = lot?.inspection?.issues ?? [];
  const highestSeverity = issues.reduce<string | null>((current, issue) => {
    const rank = issue.severity === "CRITICAL" ? 3 : issue.severity === "MODERATE" ? 2 : 1;
    const currentRank = current === "CRITICAL" ? 3 : current === "MODERATE" ? 2 : current === "MINOR" ? 1 : 0;
    return rank > currentRank ? issue.severity : current;
  }, null);

  const flags = [
    lot?.inspection?.identityRiskFlag ? "Identity risk" : null,
    lot?.inspection?.packagingRiskFlag ? "Packaging risk" : null,
    lot?.inspection?.materialRiskFlag ? "Material risk" : null,
    lot?.inspection?.samplingBlockedFlag ? "Sampling blocked" : null,
  ].filter((flag): flag is string => Boolean(flag));

  const tone =
    highestSeverity === "CRITICAL"
      ? "red"
      : highestSeverity === "MODERATE"
        ? "orange"
        : issues.length > 0
          ? "yellow"
          : flags.length > 0
            ? "orange"
            : "green";

  const summary = issues.length > 0
    ? `${issues.length} issue${issues.length === 1 ? "" : "s"} recorded${highestSeverity ? ` · Highest ${highestSeverity.toLowerCase()}` : ""}.`
    : flags.length > 0
      ? "Inspection risks were flagged for review."
      : "No inspection issues recorded yet.";

  return {
    issueCount: issues.length,
    highestSeverity,
    tone,
    summary,
    flags,
  };
}

export function getLotAuditPreview(logs: AuditLog[], lotId: string, limit = 3) {
  return logs.filter((log) => {
    if (!log.metadata || typeof log.metadata !== "object" || Array.isArray(log.metadata)) {
      return false;
    }

    return String((log.metadata as Record<string, unknown>).lotId ?? "") === lotId;
  }).slice(0, limit);
}

export function getNextInspectionLot(job: InspectionJob | null) {
  const lots = job?.lots ?? [];
  return (
    lots.find((lot) => lot.status === "INSPECTION_IN_PROGRESS") ??
    lots.find((lot) => lot.status === "ON_HOLD") ??
    lots.find((lot) => lot.status === "READY_FOR_NEXT_STAGE") ??
    lots.find((lot) => lot.status !== "READY_FOR_SAMPLING" && lot.status !== "REJECTED" && lot.status !== "COMPLETED") ??
    lots[0] ??
    null
  );
}

export function getResponseOptionsForItem(itemKey: string, responseType?: string | null) {
  const configured = getResponseOptions(itemKey);
  return configured.length > 0 ? configured : getResponseTypeOptions(responseType ?? "YES_NO");
}
