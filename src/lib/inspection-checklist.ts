import type {
  InspectionChecklistItem,
  InspectionChecklistResponse,
  InspectionDecisionStatus,
  InspectionIssue,
  InspectionMediaCategory,
} from "@/types/inspection";
import { EVIDENCE_CATEGORY_LABELS, INSPECTION_REQUIRED_MEDIA_CATEGORIES } from "@/lib/evidence-definition";

export type ChecklistOption = {
  label: string;
  value: string;
};

export type ChecklistDefinition = {
  itemKey: string;
  sectionName: string;
  itemLabel: string;
  responseType: string;
  isRequired: boolean;
  displayOrder: number;
  materialCategory?: string | null;
  options: ChecklistOption[];
  passingValues: string[];
  suggestedIssueCategories?: string[];
  requiredExceptionPhotoCategories?: InspectionMediaCategory[];
  recommendedDecision?: Extract<InspectionDecisionStatus, "ON_HOLD" | "REJECTED">;
  riskFlag?: "identity" | "packaging" | "material";
};

export const INSPECTION_SECTION_ORDER = [
  "Lot Identity",
  "Packaging / Bag Condition",
  "Seal and Label",
  "Visible Material Condition",
  "Sampling Readiness",
] as const;

export const INSPECTION_RESPONSE_TYPE_OPTIONS = [
  "YES_NO",
  "MATCH_MISMATCH",
  "MATCH_MISMATCH_PARTIAL",
  "YES_NO_CANNOT_VERIFY",
  "GOOD_DAMAGED",
  "NO_YES",
  "ACCEPTABLE_NOT_ACCEPTABLE",
  "YES_NO_NA",
  "GOOD_BROKEN_TAMPERED_NOT_APPLICABLE",
  "NO_YES_NOT_CHECKED",
  "YES_NO_HOLD",
] as const;

const YES_NO: ChecklistOption[] = [
  { label: "Yes", value: "YES" },
  { label: "No", value: "NO" },
];

const MATCH_MISMATCH: ChecklistOption[] = [
  { label: "Match", value: "MATCH" },
  { label: "Mismatch", value: "MISMATCH" },
];

const MATCH_MISMATCH_PARTIAL: ChecklistOption[] = [
  { label: "Match", value: "MATCH" },
  { label: "Mismatch", value: "MISMATCH" },
  { label: "Partial", value: "PARTIAL" },
];

const YES_NO_CANNOT_VERIFY: ChecklistOption[] = [
  { label: "Yes", value: "YES" },
  { label: "No", value: "NO" },
  { label: "Cannot verify", value: "CANNOT_VERIFY" },
];

const GOOD_DAMAGED: ChecklistOption[] = [
  { label: "Good", value: "GOOD" },
  { label: "Damaged", value: "DAMAGED" },
];

const ACCEPTABLE_NOT_ACCEPTABLE: ChecklistOption[] = [
  { label: "Acceptable", value: "ACCEPTABLE" },
  { label: "Not acceptable", value: "NOT_ACCEPTABLE" },
];

const YES_NO_NA: ChecklistOption[] = [
  { label: "Yes", value: "YES" },
  { label: "No", value: "NO" },
  { label: "Not applicable", value: "NOT_APPLICABLE" },
];

const GOOD_BROKEN_TAMPERED_NA: ChecklistOption[] = [
  { label: "Good", value: "GOOD" },
  { label: "Broken", value: "BROKEN" },
  { label: "Tampered", value: "TAMPERED" },
  { label: "Not applicable", value: "NOT_APPLICABLE" },
];

const ACCEPTABLE_NOT_ACCEPTABLE_MATERIAL: ChecklistOption[] = [
  { label: "Acceptable", value: "ACCEPTABLE" },
  { label: "Not acceptable", value: "NOT_ACCEPTABLE" },
];

const NO_YES_NOT_CHECKED: ChecklistOption[] = [
  { label: "No", value: "NO" },
  { label: "Yes", value: "YES" },
  { label: "Not checked", value: "NOT_CHECKED" },
];

const YES_NO_HOLD: ChecklistOption[] = [
  { label: "Yes", value: "YES" },
  { label: "No", value: "NO" },
  { label: "Hold", value: "HOLD" },
];

const RESPONSE_TYPE_CONFIG: Record<string, { options: ChecklistOption[]; passingValues: string[] }> = {
  YES_NO: { options: YES_NO, passingValues: ["YES"] },
  MATCH_MISMATCH: { options: MATCH_MISMATCH, passingValues: ["MATCH"] },
  MATCH_MISMATCH_PARTIAL: { options: MATCH_MISMATCH_PARTIAL, passingValues: ["MATCH"] },
  YES_NO_CANNOT_VERIFY: { options: YES_NO_CANNOT_VERIFY, passingValues: ["YES", "CANNOT_VERIFY"] },
  GOOD_DAMAGED: { options: GOOD_DAMAGED, passingValues: ["GOOD"] },
  NO_YES: {
    options: [
      { label: "No", value: "NO" },
      { label: "Yes", value: "YES" },
    ],
    passingValues: ["NO"],
  },
  ACCEPTABLE_NOT_ACCEPTABLE: { options: ACCEPTABLE_NOT_ACCEPTABLE, passingValues: ["ACCEPTABLE"] },
  YES_NO_NA: { options: YES_NO_NA, passingValues: ["YES", "NOT_APPLICABLE"] },
  GOOD_BROKEN_TAMPERED_NOT_APPLICABLE: { options: GOOD_BROKEN_TAMPERED_NA, passingValues: ["GOOD", "NOT_APPLICABLE"] },
  NO_YES_NOT_CHECKED: { options: NO_YES_NOT_CHECKED, passingValues: ["NO", "NOT_CHECKED"] },
  YES_NO_HOLD: { options: YES_NO_HOLD, passingValues: ["YES"] },
};

export const DEFAULT_INSPECTION_CHECKLIST: ChecklistDefinition[] = [
  {
    itemKey: "lot_number_matches_system_record",
    sectionName: "Lot Identity",
    itemLabel: "Lot number matches system record",
    responseType: "MATCH_MISMATCH",
    isRequired: true,
    displayOrder: 2,
    options: MATCH_MISMATCH,
    passingValues: ["MATCH"],
    suggestedIssueCategories: ["Lot mismatch"],
    requiredExceptionPhotoCategories: ["LABEL_CLOSEUP"],
    recommendedDecision: "REJECTED",
    riskFlag: "identity",
  },
  {
    itemKey: "material_name_matches_expected",
    sectionName: "Lot Identity",
    itemLabel: "Material name matches expected material",
    responseType: "MATCH_MISMATCH",
    isRequired: true,
    displayOrder: 4,
    options: MATCH_MISMATCH,
    passingValues: ["MATCH"],
    suggestedIssueCategories: ["Label mismatch", "Other"],
    requiredExceptionPhotoCategories: ["LABEL_CLOSEUP"],
    recommendedDecision: "REJECTED",
    riskFlag: "identity",
  },
  {
    itemKey: "bag_count_matches_intake",
    sectionName: "Lot Identity",
    itemLabel: "Number of bags / pieces matches intake entry",
    responseType: "MATCH_MISMATCH_PARTIAL",
    isRequired: true,
    displayOrder: 5,
    options: MATCH_MISMATCH_PARTIAL,
    passingValues: ["MATCH"],
    suggestedIssueCategories: ["Quantity mismatch"],
    recommendedDecision: "ON_HOLD",
    riskFlag: "identity",
  },
  {
    itemKey: "container_physically_intact",
    sectionName: "Packaging / Bag Condition",
    itemLabel: "Bag / container is physically intact",
    responseType: "GOOD_DAMAGED",
    isRequired: true,
    displayOrder: 7,
    options: GOOD_DAMAGED,
    passingValues: ["GOOD"],
    suggestedIssueCategories: ["Bag damage"],
    requiredExceptionPhotoCategories: ["DAMAGE_PHOTO"],
    recommendedDecision: "ON_HOLD",
    riskFlag: "packaging",
  },
  {
    itemKey: "label_readable",
    sectionName: "Seal and Label",
    itemLabel: "Label is readable",
    responseType: "YES_NO",
    isRequired: true,
    displayOrder: 14,
    options: YES_NO,
    passingValues: ["YES"],
    suggestedIssueCategories: ["Label mismatch"],
    requiredExceptionPhotoCategories: ["LABEL_CLOSEUP"],
    recommendedDecision: "ON_HOLD",
    riskFlag: "identity",
  },
  {
    itemKey: "material_appearance_visually_acceptable",
    sectionName: "Visible Material Condition",
    itemLabel: "Material appearance is visually acceptable",
    responseType: "ACCEPTABLE_NOT_ACCEPTABLE",
    isRequired: true,
    displayOrder: 17,
    options: ACCEPTABLE_NOT_ACCEPTABLE_MATERIAL,
    passingValues: ["ACCEPTABLE"],
    suggestedIssueCategories: ["Material appearance abnormal"],
    requiredExceptionPhotoCategories: ["MATERIAL_VISIBLE"],
    recommendedDecision: "ON_HOLD",
    riskFlag: "material",
  },
  {
    itemKey: "visible_contamination_observed",
    sectionName: "Visible Material Condition",
    itemLabel: "Visible contamination / foreign material observed",
    responseType: "NO_YES",
    isRequired: true,
    displayOrder: 20,
    options: [
      { label: "No", value: "NO" },
      { label: "Yes", value: "YES" },
    ],
    passingValues: ["NO"],
    suggestedIssueCategories: ["Contamination"],
    requiredExceptionPhotoCategories: ["CONTAMINATION_PHOTO"],
    recommendedDecision: "REJECTED",
    riskFlag: "material",
  },
  {
    itemKey: "packaging_allows_safe_sampling",
    sectionName: "Sampling Readiness",
    itemLabel: "Packaging condition allows safe sampling",
    responseType: "YES_NO",
    isRequired: true,
    displayOrder: 23,
    options: YES_NO,
    passingValues: ["YES"],
    suggestedIssueCategories: ["Bag damage"],
    recommendedDecision: "ON_HOLD",
    riskFlag: "packaging",
  },
  {
    itemKey: "material_accessible_for_sampling",
    sectionName: "Sampling Readiness",
    itemLabel: "Material is accessible for sampling",
    responseType: "YES_NO",
    isRequired: true,
    displayOrder: 24,
    options: YES_NO,
    passingValues: ["YES"],
    suggestedIssueCategories: ["Other"],
    recommendedDecision: "ON_HOLD",
    riskFlag: "packaging",
  },
];

export const LEGACY_DEFAULT_INSPECTION_ITEM_KEYS = [
  "lot_number_visible",
  "lot_number_matches_system_record",
  "material_name_visible",
  "material_name_matches_expected",
  "bag_count_matches_intake",
  "weight_consistent_with_intake",
  "container_physically_intact",
  "container_has_damage_or_leakage",
  "container_surface_dry_and_clean",
  "outer_packaging_acceptable_for_handling",
  "multiple_bags_consistent_condition",
  "original_seal_present_if_expected",
  "seal_condition_acceptable",
  "label_readable",
  "label_complete_for_identification",
  "label_damage_affects_identification",
  "material_appearance_visually_acceptable",
  "material_color_consistent",
  "visible_moisture_observed",
  "visible_contamination_observed",
  "lumps_or_texture_issue_observed",
  "odor_abnormal_if_applicable",
  "packaging_allows_safe_sampling",
  "material_accessible_for_sampling",
  "lot_acceptable_for_sampling",
] as const;

export const INSPECTION_MEDIA_LABELS: Record<InspectionMediaCategory, string> = EVIDENCE_CATEGORY_LABELS;

export const INSPECTION_ISSUE_CATEGORIES = [
  "Label mismatch",
  "Lot mismatch",
  "Bag damage",
  "Seal issue",
  "Leakage",
  "Moisture issue",
  "Contamination",
  "Material appearance abnormal",
  "Quantity mismatch",
  "Other",
] as const;

export const ISSUE_SEVERITY_OPTIONS: ChecklistOption[] = [
  { label: "Minor", value: "MINOR" },
  { label: "Moderate", value: "MODERATE" },
  { label: "Critical", value: "CRITICAL" },
];

export const BASE_REQUIRED_INSPECTION_MEDIA: InspectionMediaCategory[] = [
  ...INSPECTION_REQUIRED_MEDIA_CATEGORIES,
];

export function getChecklistDefinition(itemKey: string) {
  return DEFAULT_INSPECTION_CHECKLIST.find((item) => item.itemKey === itemKey) ?? null;
}

export function getChecklistDefinitionById(item: Pick<InspectionChecklistItem, "itemKey">) {
  return getChecklistDefinition(item.itemKey);
}

export function buildMasterSeedPayload() {
  return DEFAULT_INSPECTION_CHECKLIST.map((item) => ({
    itemKey: item.itemKey,
    sectionName: item.sectionName,
    itemLabel: item.itemLabel,
    responseType: item.responseType,
    isRequired: item.isRequired,
    materialCategory: item.materialCategory ?? null,
    displayOrder: item.displayOrder,
    isActive: true,
  }));
}

export function groupChecklistItems(items: InspectionChecklistItem[]) {
  return INSPECTION_SECTION_ORDER.map((sectionName) => ({
    sectionName,
    items: items
      .filter((item) => item.sectionName === sectionName)
      .sort((left, right) => left.displayOrder - right.displayOrder),
  })).filter((group) => group.items.length > 0);
}

export function getResponseOptions(itemKey: string): ChecklistOption[] {
  return getChecklistDefinition(itemKey)?.options ?? [];
}

export function getResponseTypeOptions(responseType: string): ChecklistOption[] {
  return RESPONSE_TYPE_CONFIG[responseType]?.options ?? YES_NO;
}

export function getPassingValuesForResponseType(responseType: string): string[] {
  return RESPONSE_TYPE_CONFIG[responseType]?.passingValues ?? ["YES"];
}

export function isSupportedInspectionResponseType(responseType: string): boolean {
  return responseType in RESPONSE_TYPE_CONFIG;
}

export function isExceptionResponse(itemKey: string, responseValue: string | null | undefined, responseType?: string | null): boolean {
  if (!responseValue) {
    return false;
  }

  const definition = getChecklistDefinition(itemKey);
  const passingValues = definition?.passingValues ?? getPassingValuesForResponseType(responseType ?? "YES_NO");
  return !passingValues.includes(responseValue);
}

export function getSuggestedIssueCategoriesFromResponses(
  items: InspectionChecklistItem[],
  responses: Array<Pick<InspectionChecklistResponse, "checklistItemMasterId" | "responseValue">>,
): string[] {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const categories = new Set<string>();

  for (const response of responses) {
    const item = itemById.get(response.checklistItemMasterId);
    if (!item || !response.responseValue || !isExceptionResponse(item.itemKey, response.responseValue, item.responseType)) {
      continue;
    }

    for (const category of getChecklistDefinition(item.itemKey)?.suggestedIssueCategories ?? []) {
      categories.add(category);
    }
  }

  return Array.from(categories);
}

export function deriveRequiredInspectionMedia(
  items: InspectionChecklistItem[],
  responses: Array<Pick<InspectionChecklistResponse, "checklistItemMasterId" | "responseValue">>,
  options?: {
    requiredMediaCategories?: string[];
  },
): InspectionMediaCategory[] {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const baseRequiredCategories =
    Array.isArray(options?.requiredMediaCategories)
      ? options.requiredMediaCategories
      : BASE_REQUIRED_INSPECTION_MEDIA;
  const required = new Set<InspectionMediaCategory>(
    baseRequiredCategories as InspectionMediaCategory[],
  );

  for (const response of responses) {
    const item = itemById.get(response.checklistItemMasterId);
    if (!item || !response.responseValue || !isExceptionResponse(item.itemKey, response.responseValue, item.responseType)) {
      continue;
    }

    for (const category of getChecklistDefinition(item.itemKey)?.requiredExceptionPhotoCategories ?? []) {
      required.add(category);
    }
  }

  return Array.from(required);
}

export function deriveInspectionAssessment(input: {
  items: InspectionChecklistItem[];
  responses: InspectionChecklistResponse[];
  issues: InspectionIssue[];
  mediaCategories: string[];
  requiredMediaCategories?: string[];
}) {
  const responseByItemId = new Map(input.responses.map((response) => [response.checklistItemMasterId, response]));
  let identityRiskFlag = false;
  let packagingRiskFlag = false;
  let materialRiskFlag = false;
  let criticalRejectSignal = false;
  let holdSignal = false;
  const missingRequiredItemLabels: string[] = [];
  const exceptionItems: string[] = [];

  for (const item of input.items) {
    const response = responseByItemId.get(item.id);
    if (item.isRequired && !response?.responseValue) {
      missingRequiredItemLabels.push(item.itemLabel);
      continue;
    }

    if (!response?.responseValue || !isExceptionResponse(item.itemKey, response.responseValue, item.responseType)) {
      continue;
    }

    exceptionItems.push(item.itemLabel);
    const definition = getChecklistDefinition(item.itemKey);

    if (definition?.riskFlag === "identity") {
      identityRiskFlag = true;
    }
    if (definition?.riskFlag === "packaging") {
      packagingRiskFlag = true;
    }
    if (definition?.riskFlag === "material") {
      materialRiskFlag = true;
    }

    if (definition?.recommendedDecision === "REJECTED") {
      criticalRejectSignal = true;
    } else {
      holdSignal = true;
    }
  }

  for (const issue of input.issues) {
    if (issue.severity === "CRITICAL") {
      criticalRejectSignal = true;
    } else {
      holdSignal = true;
    }
  }

  const requiredMediaCategories = deriveRequiredInspectionMedia(input.items, input.responses, {
    requiredMediaCategories: input.requiredMediaCategories,
  });
  const uploadedMedia = new Set(input.mediaCategories);
  const missingRequiredMedia = requiredMediaCategories.filter((category) => !uploadedMedia.has(category));
  const samplingBlockedFlag =
    missingRequiredMedia.length > 0 || criticalRejectSignal || holdSignal || exceptionItems.length > 0;

  let recommendedDecision: InspectionDecisionStatus = "PENDING";
  if (criticalRejectSignal) {
    recommendedDecision = "REJECTED";
  } else if (missingRequiredMedia.length === 0 && exceptionItems.length === 0) {
    recommendedDecision = "READY_FOR_SAMPLING";
  } else if (holdSignal || exceptionItems.length > 0 || missingRequiredMedia.length > 0) {
    recommendedDecision = "ON_HOLD";
  }

  return {
    identityRiskFlag,
    packagingRiskFlag,
    materialRiskFlag,
    samplingBlockedFlag,
    issueCount: input.issues.length,
    recommendedDecision,
    missingRequiredItemLabels,
    missingRequiredMedia,
    requiredMediaCategories,
    hasExceptions: exceptionItems.length > 0,
    exceptionItems,
  };
}

export function buildDecisionValidation(input: {
  decisionStatus: InspectionDecisionStatus;
  assessment: ReturnType<typeof deriveInspectionAssessment>;
  issues: InspectionIssue[];
  overallRemark?: string | null;
}) {
  const errors: string[] = [];

  if (input.decisionStatus === "READY_FOR_SAMPLING") {
    if (input.assessment.missingRequiredMedia.length > 0) {
      errors.push("Upload all required inspection media before marking the lot ready for sampling.");
    }
    if (input.assessment.identityRiskFlag || input.assessment.packagingRiskFlag || input.assessment.materialRiskFlag) {
      errors.push("Resolve all blocking identity, packaging, and material exceptions before passing the lot.");
    }
  }

  if (input.decisionStatus === "ON_HOLD" || input.decisionStatus === "REJECTED") {
    if (input.issues.length === 0) {
      errors.push("Add at least one issue category before putting a lot on hold or rejecting it.");
    }
    if (!input.overallRemark || input.overallRemark.trim().length === 0) {
      errors.push(input.decisionStatus === "REJECTED" ? "Remarks are required for rejected lots." : "Reason is required when placing a lot on hold.");
    }
  }

  return errors;
}
