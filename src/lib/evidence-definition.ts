import type { InspectionMediaCategory, SampleMediaType } from "@/types/inspection";

export type SamplingStepKey = "before" | "during" | "after";
export type SamplingStepCategory = "BEFORE" | "DURING" | "AFTER";

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
  { key: "during", category: "DURING", title: "During", note: "Mid-process traceability" },
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
    note: "Optional traceability photo for the selected container.",
  },
  {
    mediaType: "SAMPLE_LABEL",
    uploadCategory: "LABEL_CLOSEUP",
    required: false,
    title: "Sample label",
    note: "Optional visible sample identity and label text.",
  },
  {
    mediaType: "SEALED_SAMPLE",
    uploadCategory: "SEALED_BAG",
    required: false,
    title: "Sealed sample",
    note: "Optional final sealed sample proof before packeting handoff.",
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
  category: InspectionMediaCategory;
  fallbackLabel: string;
}> = [
  { category: "BAG", fallbackLabel: "Bag Photo" },
  { category: "SAMPLING_IN_PROGRESS", fallbackLabel: "Lot Sampling Photo" },
  { category: "SEAL", fallbackLabel: "Seal Photo" },
  { category: "BEFORE", fallbackLabel: "Sampling Before" },
  { category: "DURING", fallbackLabel: "Sampling During" },
  { category: "AFTER", fallbackLabel: "Sampling After" },
];
