import type { InspectionMediaCategory, SampleMediaType } from "@/types/inspection";

export type SamplingStepKey = "before" | "during" | "after";
export type SamplingStepCategory = "BEFORE" | "DURING" | "AFTER";
export type CanonicalEvidenceCategory = Exclude<InspectionMediaCategory, "BAG" | "SEAL" | "DURING">;

export const EVIDENCE_CATEGORY_LABELS: Record<InspectionMediaCategory, string> = {
  BEFORE: "Sampling before photo",
  DURING: "Sampling during photo",
  AFTER: "Sampling after photo",
  BAG: "Bag photo",
  SEAL: "Seal photo",
  BAG_WITH_LOT_NO: "Bag with lot number",
  MATERIAL_VISIBLE: "Material visible",
  SAMPLING_IN_PROGRESS: "Sampling in progress",
  SEALED_BAG: "Sealed bag",
  SEAL_CLOSEUP: "Seal close-up",
  BAG_CONDITION: "Bag condition",
  DAMAGE_PHOTO: "Damage photo",
  HOMOGENEOUS: "Homogeneous sample",
  LOT_OVERVIEW: "Lot overview photo",
  BAG_CLOSEUP: "Bag / container close-up",
  LABEL_CLOSEUP: "Label close-up",
  INSPECTION_IN_PROGRESS: "Inspection in progress",
  CONTAMINATION_PHOTO: "Contamination photo",
};

export const CANONICAL_EVIDENCE_CATEGORY_KEYS = [
  "BEFORE",
  "AFTER",
  "BAG_WITH_LOT_NO",
  "MATERIAL_VISIBLE",
  "SAMPLING_IN_PROGRESS",
  "SEALED_BAG",
  "SEAL_CLOSEUP",
  "BAG_CONDITION",
  "DAMAGE_PHOTO",
  "HOMOGENEOUS",
  "LOT_OVERVIEW",
  "BAG_CLOSEUP",
  "LABEL_CLOSEUP",
  "INSPECTION_IN_PROGRESS",
  "CONTAMINATION_PHOTO",
] as const satisfies readonly CanonicalEvidenceCategory[];

const CANONICAL_EVIDENCE_CATEGORY_SET = new Set<string>(CANONICAL_EVIDENCE_CATEGORY_KEYS);

export const LEGACY_EVIDENCE_CATEGORY_ALIASES: Record<string, CanonicalEvidenceCategory> = {
  // Legacy policy labels
  "Bag photo with visible LOT no": "BAG_WITH_LOT_NO",
  "Material in bag": "MATERIAL_VISIBLE",
  "During Sampling Photo": "SAMPLING_IN_PROGRESS",
  "Sample Completion": "SEALED_BAG",
  "Seal on bag": "SEAL_CLOSEUP",
  "Bag condition": "BAG_CONDITION",
  "Whole Job bag palletized and packed": "LOT_OVERVIEW",

  // Corrupted legacy variants found in settings payloads
  BagphotowithvisibleLOTno: "BAG_WITH_LOT_NO",
  BagconditionBagphotowithvisibleLOTno: "BAG_CONDITION",
  SealCloseup: "SEAL_CLOSEUP",
  MaterialVisible: "MATERIAL_VISIBLE",

  // Canonical UI labels
  "Sampling before photo": "BEFORE",
  "Sampling after photo": "AFTER",
  "Bag with lot number": "BAG_WITH_LOT_NO",
  "Material visible": "MATERIAL_VISIBLE",
  "Sampling in progress": "SAMPLING_IN_PROGRESS",
  "Sealed bag": "SEALED_BAG",
  "Seal close-up": "SEAL_CLOSEUP",
  "Damage photo": "DAMAGE_PHOTO",
  "Homogeneous sample": "HOMOGENEOUS",
  "Lot overview photo": "LOT_OVERVIEW",
  "Bag / container close-up": "BAG_CLOSEUP",
  "Label close-up": "LABEL_CLOSEUP",
  "Inspection in progress": "INSPECTION_IN_PROGRESS",
  "Contamination photo": "CONTAMINATION_PHOTO",

  // Legacy category keys and upload aliases
  BAG: "BAG_WITH_LOT_NO",
  SEAL: "SEALED_BAG",
  DURING: "SAMPLING_IN_PROGRESS",
  LOT_BAG: "BAG_WITH_LOT_NO",
  LOT_SEAL: "SEALED_BAG",
};

/**
 * Backward-compatible mapping for image categories.
 * Maps legacy labels and canonical labels to the internal key (InspectionMediaCategory).
 */
export const LABEL_TO_CATEGORY_KEY_MAP: Record<string, CanonicalEvidenceCategory> = {
  ...LEGACY_EVIDENCE_CATEGORY_ALIASES,
  "Bag photo": "BAG_WITH_LOT_NO",
  "Seal photo": "SEALED_BAG",
  "Sampling during photo": "SAMPLING_IN_PROGRESS",
};

export function normalizeEvidenceCategoryKey(value: unknown): CanonicalEvidenceCategory | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (CANONICAL_EVIDENCE_CATEGORY_SET.has(trimmed)) {
    return trimmed as CanonicalEvidenceCategory;
  }

  const mapped = LABEL_TO_CATEGORY_KEY_MAP[trimmed];
  if (mapped) {
    return mapped;
  }

  const upper = trimmed.toUpperCase();
  if (CANONICAL_EVIDENCE_CATEGORY_SET.has(upper)) {
    return upper as CanonicalEvidenceCategory;
  }
  return LABEL_TO_CATEGORY_KEY_MAP[upper] ?? null;
}

export function isCanonicalEvidenceCategoryKey(value: unknown): value is CanonicalEvidenceCategory {
  return typeof value === "string" && CANONICAL_EVIDENCE_CATEGORY_SET.has(value.trim());
}

export function getUploadCategoryKey(label: string): string {
  const key = normalizeEvidenceCategoryKey(label);
  if (key) return key;

  // Fallback: slugify the label if no map found
  return label.trim()
    .toUpperCase()
    .replaceAll(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function getEvidenceCategoryLabel(category: InspectionMediaCategory): string {
  return EVIDENCE_CATEGORY_LABELS[category] ?? category;
}

export const LOT_INTAKE_REQUIRED_MEDIA_CATEGORIES = [
  "BAG_WITH_LOT_NO",
  "MATERIAL_VISIBLE",
  "SAMPLING_IN_PROGRESS",
  "SEALED_BAG",
  "BAG_CONDITION",
] as const satisfies readonly InspectionMediaCategory[];

export const LOT_INTAKE_OPTIONAL_MEDIA_CATEGORIES = [
  "SEAL_CLOSEUP",
  "DAMAGE_PHOTO",
] as const satisfies readonly InspectionMediaCategory[];

export const INSPECTION_REQUIRED_MEDIA_CATEGORIES = [
  "LOT_OVERVIEW",
] as const satisfies readonly InspectionMediaCategory[];

export const LOT_SAMPLING_STEP_DEFINITIONS: ReadonlyArray<{
  key: SamplingStepKey;
  category: SamplingStepCategory;
  title: string;
  note: string;
}> = [
  { key: "before", category: "BEFORE", title: "Before", note: "Initial condition capture" },
  { key: "during", category: "DURING", title: "During", note: "Mid-process evidence" },
  { key: "after", category: "AFTER", title: "After", note: "Post-process evidence" },
];

export const LOT_INTAKE_EVIDENCE_ITEMS: ReadonlyArray<{
  category: InspectionMediaCategory;
  required: boolean;
  hint: string;
}> = [
  { category: "BAG_WITH_LOT_NO", required: true, hint: "LOT number must be visible in frame." },
  { category: "MATERIAL_VISIBLE", required: true, hint: "Show the material clearly." },
  { category: "SAMPLING_IN_PROGRESS", required: true, hint: "Capture the sampling step in action." },
  { category: "SEALED_BAG", required: true, hint: "Show the sealed unit after handling." },
  { category: "BAG_CONDITION", required: true, hint: "Capture the overall bag condition." },
  { category: "SEAL_CLOSEUP", required: false, hint: "Optional zoomed seal proof." },
  { category: "DAMAGE_PHOTO", required: false, hint: "Use when damage or contamination exists." },
];

export const SAMPLE_EVIDENCE_ITEMS: ReadonlyArray<{
  mediaType: SampleMediaType;
  uploadCategory: InspectionMediaCategory;
  required: boolean;
  title: string;
  note: string;
  readinessHint?: string;
}> = [
  {
    mediaType: "HOMOGENIZED_SAMPLE",
    uploadCategory: "HOMOGENEOUS",
    required: true,
    title: "Homogenized sample",
    note: "Only required sample photo before packet generation.",
    readinessHint: "Upload homogenized sample photo",
  },
  {
    mediaType: "SAMPLING_IN_PROGRESS",
    uploadCategory: "SAMPLING_IN_PROGRESS",
    required: false,
    title: "During sampling",
    note: "Optional process proof if your team wants it.",
  },
  {
    mediaType: "SAMPLE_CONTAINER",
    uploadCategory: "BAG_CONDITION",
    required: false,
    title: "Sample container",
    note: "Optional evidence photo for the selected container.",
  },
  {
    mediaType: "SAMPLE_LABEL",
    uploadCategory: "LABEL_CLOSEUP",
    required: false,
    title: "Sample label",
    note: "Optional visible sample identity and label text.",
  },
  {
    mediaType: "SAMPLE_CONDITION",
    uploadCategory: "LOT_OVERVIEW",
    required: false,
    title: "Sample condition",
    note: "Optional condition or quality photo.",
  },
];

export const REQUIRED_SAMPLE_MEDIA_TYPES = SAMPLE_EVIDENCE_ITEMS.filter((item) => item.required).map((item) => item.mediaType);

export const REPORT_VISUAL_EVIDENCE_ORDER: ReadonlyArray<{
  category: CanonicalEvidenceCategory;
  fallbackLabel: string;
}> = [
  { category: "BAG_WITH_LOT_NO", fallbackLabel: "Bag Photo" },
  { category: "SAMPLING_IN_PROGRESS", fallbackLabel: "Lot Sampling Photo" },
  { category: "SEALED_BAG", fallbackLabel: "Seal Photo" },
  { category: "BEFORE", fallbackLabel: "Sampling Before" },
  { category: "AFTER", fallbackLabel: "Sampling After" },
];
