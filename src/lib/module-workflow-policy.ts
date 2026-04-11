import type { ModuleWorkflowSettings } from "@prisma/client";
import {
  CANONICAL_EVIDENCE_CATEGORY_KEYS,
  EVIDENCE_CATEGORY_LABELS,
  isCanonicalEvidenceCategoryKey,
  normalizeEvidenceCategoryKey,
  type CanonicalEvidenceCategory,
} from "./evidence-definition";

export type FinalDecisionApproverPolicy = "MANAGER" | "ADMIN" | "MANAGER_ADMIN";
export type SealEditPolicy = "ADMIN_ONLY" | "ALLOWED";
export type ContainerTypeSource = "MASTER_ONLY";
export type PacketPurposeMode = "OPTIONAL" | "RND_OWNED";

export type ModuleWorkflowPolicy = {
  workflow: {
    creatorIsDefaultAssignee: boolean;
    deadlineRequired: boolean;
    decisionRequiredBeforeSampling: boolean;
    submitToRndEnabled: boolean;
    allowJobCollaborators: boolean;
    autoLotNumbering: boolean;
    lotNumberPrefix: string;
    lotNumberSequenceFormat: string;
    autoSampleIdGeneration: boolean;
    sampleIdPrefix: string;
    sampleIdSequenceFormat: string;
    autoPacketIdGeneration: boolean;
    packetIdPrefix: string;
    packetIdSequenceFormat: string;
    finalDecisionApproverPolicy: FinalDecisionApproverPolicy;
    lockPacketEditingAfterRndSubmit: boolean;
  };
  images: {
    requiredImageCategories: CanonicalEvidenceCategory[];
    optionalImageCategories: CanonicalEvidenceCategory[];
    hiddenImageCategories: CanonicalEvidenceCategory[];
    imageTimestampRequired: boolean;
  };
  seal: {
    sealScanRequired: boolean;
    bulkSealGenerationEnabled: boolean;
    sealEditPolicy: SealEditPolicy;
    sealEditRoles: string[];
  };
  sampling: {
    containerTypeSource: ContainerTypeSource;
    homogeneousProofRequired: boolean;
    homogeneousWeightEnabled: false;
  };
  packet: {
    packetWeightRequired: true;
    packetPurposeMode: PacketPurposeMode;
  };
  approval: {
    holdRejectNotesMandatory: boolean;
    notifyOnAssign: boolean;
    notifyOnSubmit: boolean;
    notifyOnDecision: boolean;
  };
  access: {
    allowedModuleIds: string[];
  };
  ui: {
    showOptionalImageSection: boolean;
    showBlockersInline: boolean;
  };
};

type FlatSettingsShape = {
  creatorIsDefaultAssignee: boolean;
  deadlineRequired: boolean;
  decisionRequiredBeforeSampling: boolean;
  submitToRndEnabled: boolean;
  allowJobCollaborators: boolean;
  autoLotNumbering: boolean;
  lotNumberPrefix: string | null;
  lotNumberSequenceFormat: string | null;
  autoSampleIdGeneration: boolean;
  sampleIdPrefix: string | null;
  sampleIdSequenceFormat: string | null;
  autoPacketIdGeneration: boolean;
  packetIdPrefix: string | null;
  packetIdSequenceFormat: string | null;
  finalDecisionApproverPolicy: string;
  lockPacketEditingAfterRndSubmit: boolean;
  sealScanRequired: boolean;
  imageTimestampRequired: boolean;
  requiredImageCategories: CanonicalEvidenceCategory[];
  optionalImageCategories: CanonicalEvidenceCategory[];
  hiddenImageCategories: CanonicalEvidenceCategory[];
  bulkSealGenerationEnabled: boolean;
  sealEditPolicy: string;
  sealEditRoles: string[];
  containerTypeSource: string;
  homogeneousProofRequired: boolean;
  packetPurposeMode: string;
  holdRejectNotesMandatory: boolean;
  notifyOnAssign: boolean;
  notifyOnSubmit: boolean;
  notifyOnDecision: boolean;
  allowedModuleIds: string[];
  showOptionalImageSection: boolean;
  showBlockersInline: boolean;
};

type FlatSettingsInput = Omit<
  Partial<FlatSettingsShape>,
  "requiredImageCategories" | "optionalImageCategories" | "hiddenImageCategories"
> & {
  requiredImageCategories?: unknown;
  optionalImageCategories?: unknown;
  hiddenImageCategories?: unknown;
};

type ImagePolicyBuckets = {
  requiredImageCategories: unknown[];
  optionalImageCategories: unknown[];
  hiddenImageCategories: unknown[];
};

export const defaultModuleWorkflowSettings: FlatSettingsShape = {
  creatorIsDefaultAssignee: true,
  deadlineRequired: false,
  decisionRequiredBeforeSampling: true,
  submitToRndEnabled: true,
  allowJobCollaborators: true,
  autoLotNumbering: false,
  lotNumberPrefix: "LOT",
  lotNumberSequenceFormat: "0001",
  autoSampleIdGeneration: true,
  sampleIdPrefix: "SMP",
  sampleIdSequenceFormat: "0001",
  autoPacketIdGeneration: true,
  packetIdPrefix: "PKT",
  packetIdSequenceFormat: "0001",
  finalDecisionApproverPolicy: "MANAGER_ADMIN",
  lockPacketEditingAfterRndSubmit: true,
  sealScanRequired: true,
  imageTimestampRequired: false,
  requiredImageCategories: [
    "BAG_WITH_LOT_NO",
    "MATERIAL_VISIBLE",
    "SAMPLING_IN_PROGRESS",
    "SEALED_BAG",
    "SEAL_CLOSEUP",
    "BAG_CONDITION",
  ],
  optionalImageCategories: ["LOT_OVERVIEW"],
  hiddenImageCategories: [],
  bulkSealGenerationEnabled: true,
  sealEditPolicy: "ADMIN_ONLY",
  sealEditRoles: ["ADMIN"],
  containerTypeSource: "MASTER_ONLY",
  homogeneousProofRequired: true,
  packetPurposeMode: "OPTIONAL",
  holdRejectNotesMandatory: true,
  notifyOnAssign: true,
  notifyOnSubmit: true,
  notifyOnDecision: true,
  allowedModuleIds: ["home", "inspection", "jobs", "rnd", "documents", "exceptions", "admin", "settings", "master-data"],
  showOptionalImageSection: true,
  showBlockersInline: true,
};

function normalizeStringArray(values: unknown, fallback: string[]) {
  if (!Array.isArray(values)) {
    return fallback;
  }
  const normalized = values
    .map((value) => {
      if (typeof value !== "string") return "";
      return value.trim();
    })
    .filter(Boolean);

  return Array.from(new Set(normalized));
}

function normalizeImageCategoryArray(
  values: unknown,
  fallback: CanonicalEvidenceCategory[],
): CanonicalEvidenceCategory[] {
  if (!Array.isArray(values)) {
    return fallback;
  }

  const normalized = values
    .map((value) => normalizeEvidenceCategoryKey(value))
    .filter((value): value is CanonicalEvidenceCategory => Boolean(value));

  return Array.from(new Set(normalized));
}

type ModuleWorkflowPolicyInput = Omit<Partial<ModuleWorkflowPolicy>, "images"> & {
  images?: {
    requiredImageCategories?: unknown;
    optionalImageCategories?: unknown;
    hiddenImageCategories?: unknown;
    imageTimestampRequired?: boolean;
  };
};

export function validateImagePolicyCategoryBuckets(input: ModuleWorkflowPolicyInput | null | undefined): Array<{
  bucket: "requiredImageCategories" | "optionalImageCategories" | "hiddenImageCategories";
  value: string;
}> {
  const issues: Array<{
    bucket: "requiredImageCategories" | "optionalImageCategories" | "hiddenImageCategories";
    value: string;
  }> = [];

  const buckets: Array<{
    bucket: "requiredImageCategories" | "optionalImageCategories" | "hiddenImageCategories";
    values: unknown;
  }> = [
    { bucket: "requiredImageCategories", values: input?.images?.requiredImageCategories },
    { bucket: "optionalImageCategories", values: input?.images?.optionalImageCategories },
    { bucket: "hiddenImageCategories", values: input?.images?.hiddenImageCategories },
  ];

  for (const entry of buckets) {
    if (!Array.isArray(entry.values)) {
      continue;
    }
    for (const raw of entry.values) {
      if (typeof raw !== "string") {
        issues.push({ bucket: entry.bucket, value: String(raw) });
        continue;
      }
      if (!isCanonicalEvidenceCategoryKey(raw)) {
        issues.push({ bucket: entry.bucket, value: raw });
      }
    }
  }

  return issues;
}

export function getCanonicalImagePolicyCategoryKeys() {
  return [...CANONICAL_EVIDENCE_CATEGORY_KEYS];
}

export function getImagePolicyCategoryLabel(category: CanonicalEvidenceCategory) {
  return EVIDENCE_CATEGORY_LABELS[category] ?? category;
}

function normalizeApproverPolicy(value: unknown): FinalDecisionApproverPolicy {
  return value === "MANAGER" || value === "ADMIN" || value === "MANAGER_ADMIN" ? value : "MANAGER_ADMIN";
}

function normalizeSealEditPolicy(value: unknown): SealEditPolicy {
  return value === "ALLOWED" ? "ALLOWED" : "ADMIN_ONLY";
}

function normalizeContainerTypeSource(value: unknown): ContainerTypeSource {
  return value === "MASTER_ONLY" ? "MASTER_ONLY" : "MASTER_ONLY";
}

function normalizePacketPurposeMode(value: unknown): PacketPurposeMode {
  return value === "RND_OWNED" ? "RND_OWNED" : "OPTIONAL";
}

export function repairEmptyImagePolicyBuckets<T extends ImagePolicyBuckets>(input: T): T {
  const required = Array.isArray(input.requiredImageCategories) ? input.requiredImageCategories : [];
  const optional = Array.isArray(input.optionalImageCategories) ? input.optionalImageCategories : [];
  const hidden = Array.isArray(input.hiddenImageCategories) ? input.hiddenImageCategories : [];
  const isAllEmpty = required.length === 0 && optional.length === 0 && hidden.length === 0;

  if (!isAllEmpty) {
    return input;
  }

  return {
    ...input,
    requiredImageCategories: [...defaultModuleWorkflowSettings.requiredImageCategories],
    optionalImageCategories: [...defaultModuleWorkflowSettings.optionalImageCategories],
    hiddenImageCategories: [...defaultModuleWorkflowSettings.hiddenImageCategories],
  };
}

function normalizeFlatSettings(value: FlatSettingsInput | null | undefined): FlatSettingsShape {
  const normalized = {
    creatorIsDefaultAssignee:
      value?.creatorIsDefaultAssignee ?? defaultModuleWorkflowSettings.creatorIsDefaultAssignee,
    deadlineRequired: value?.deadlineRequired ?? defaultModuleWorkflowSettings.deadlineRequired,
    decisionRequiredBeforeSampling:
      value?.decisionRequiredBeforeSampling ?? defaultModuleWorkflowSettings.decisionRequiredBeforeSampling,
    submitToRndEnabled: value?.submitToRndEnabled ?? defaultModuleWorkflowSettings.submitToRndEnabled,
    allowJobCollaborators:
      value?.allowJobCollaborators ?? defaultModuleWorkflowSettings.allowJobCollaborators,
    autoLotNumbering: value?.autoLotNumbering ?? defaultModuleWorkflowSettings.autoLotNumbering,
    lotNumberPrefix: (typeof value?.lotNumberPrefix === "string" && value.lotNumberPrefix.trim()) || defaultModuleWorkflowSettings.lotNumberPrefix,
    lotNumberSequenceFormat:
      (typeof value?.lotNumberSequenceFormat === "string" && value.lotNumberSequenceFormat.trim()) ||
      defaultModuleWorkflowSettings.lotNumberSequenceFormat,
    autoSampleIdGeneration: value?.autoSampleIdGeneration ?? defaultModuleWorkflowSettings.autoSampleIdGeneration,
    sampleIdPrefix: (typeof value?.sampleIdPrefix === "string" && value.sampleIdPrefix.trim()) || defaultModuleWorkflowSettings.sampleIdPrefix,
    sampleIdSequenceFormat:
      (typeof value?.sampleIdSequenceFormat === "string" && value.sampleIdSequenceFormat.trim()) ||
      defaultModuleWorkflowSettings.sampleIdSequenceFormat,
    autoPacketIdGeneration:
      value?.autoPacketIdGeneration ?? defaultModuleWorkflowSettings.autoPacketIdGeneration,
    packetIdPrefix:
      (typeof value?.packetIdPrefix === "string" && value.packetIdPrefix.trim()) ||
      defaultModuleWorkflowSettings.packetIdPrefix,
    packetIdSequenceFormat:
      (typeof value?.packetIdSequenceFormat === "string" && value.packetIdSequenceFormat.trim()) ||
      defaultModuleWorkflowSettings.packetIdSequenceFormat,
    finalDecisionApproverPolicy: normalizeApproverPolicy(value?.finalDecisionApproverPolicy),
    lockPacketEditingAfterRndSubmit:
      value?.lockPacketEditingAfterRndSubmit ?? defaultModuleWorkflowSettings.lockPacketEditingAfterRndSubmit,
    sealScanRequired: value?.sealScanRequired ?? defaultModuleWorkflowSettings.sealScanRequired,
    imageTimestampRequired: value?.imageTimestampRequired ?? defaultModuleWorkflowSettings.imageTimestampRequired,
    requiredImageCategories: normalizeImageCategoryArray(value?.requiredImageCategories, defaultModuleWorkflowSettings.requiredImageCategories),
    optionalImageCategories: normalizeImageCategoryArray(value?.optionalImageCategories, defaultModuleWorkflowSettings.optionalImageCategories),
    hiddenImageCategories: normalizeImageCategoryArray(value?.hiddenImageCategories, defaultModuleWorkflowSettings.hiddenImageCategories),
    bulkSealGenerationEnabled: value?.bulkSealGenerationEnabled ?? defaultModuleWorkflowSettings.bulkSealGenerationEnabled,
    sealEditPolicy: normalizeSealEditPolicy(value?.sealEditPolicy),
    sealEditRoles: normalizeStringArray(value?.sealEditRoles, defaultModuleWorkflowSettings.sealEditRoles),
    containerTypeSource: normalizeContainerTypeSource(value?.containerTypeSource),
    homogeneousProofRequired: value?.homogeneousProofRequired ?? defaultModuleWorkflowSettings.homogeneousProofRequired,
    packetPurposeMode: normalizePacketPurposeMode(value?.packetPurposeMode),
    holdRejectNotesMandatory:
      value?.holdRejectNotesMandatory ?? defaultModuleWorkflowSettings.holdRejectNotesMandatory,
    notifyOnAssign: value?.notifyOnAssign ?? defaultModuleWorkflowSettings.notifyOnAssign,
    notifyOnSubmit: value?.notifyOnSubmit ?? defaultModuleWorkflowSettings.notifyOnSubmit,
    notifyOnDecision: value?.notifyOnDecision ?? defaultModuleWorkflowSettings.notifyOnDecision,
    allowedModuleIds: normalizeStringArray(value?.allowedModuleIds, defaultModuleWorkflowSettings.allowedModuleIds),
    showOptionalImageSection: value?.showOptionalImageSection ?? defaultModuleWorkflowSettings.showOptionalImageSection,
    showBlockersInline: value?.showBlockersInline ?? defaultModuleWorkflowSettings.showBlockersInline,
  };

  return repairEmptyImagePolicyBuckets(normalized);
}

export function toModuleWorkflowPolicy(value: Partial<FlatSettingsShape> | ModuleWorkflowSettings | null | undefined): ModuleWorkflowPolicy {
  const normalized = normalizeFlatSettings(value ?? undefined);
  return {
    workflow: {
      creatorIsDefaultAssignee: normalized.creatorIsDefaultAssignee,
      deadlineRequired: normalized.deadlineRequired,
      decisionRequiredBeforeSampling: normalized.decisionRequiredBeforeSampling,
      submitToRndEnabled: normalized.submitToRndEnabled,
      allowJobCollaborators: normalized.allowJobCollaborators,
      autoLotNumbering: normalized.autoLotNumbering,
      lotNumberPrefix: normalized.lotNumberPrefix ?? defaultModuleWorkflowSettings.lotNumberPrefix ?? "LOT",
      lotNumberSequenceFormat: normalized.lotNumberSequenceFormat ?? defaultModuleWorkflowSettings.lotNumberSequenceFormat ?? "0001",
      autoSampleIdGeneration: normalized.autoSampleIdGeneration,
      sampleIdPrefix: normalized.sampleIdPrefix ?? defaultModuleWorkflowSettings.sampleIdPrefix ?? "SMP",
      sampleIdSequenceFormat: normalized.sampleIdSequenceFormat ?? defaultModuleWorkflowSettings.sampleIdSequenceFormat ?? "0001",
      autoPacketIdGeneration: normalized.autoPacketIdGeneration,
      packetIdPrefix: normalized.packetIdPrefix ?? defaultModuleWorkflowSettings.packetIdPrefix ?? "PKT",
      packetIdSequenceFormat: normalized.packetIdSequenceFormat ?? defaultModuleWorkflowSettings.packetIdSequenceFormat ?? "0001",
      finalDecisionApproverPolicy: normalizeApproverPolicy(normalized.finalDecisionApproverPolicy),
      lockPacketEditingAfterRndSubmit: normalized.lockPacketEditingAfterRndSubmit,
    },
    images: {
      requiredImageCategories: normalized.requiredImageCategories,
      optionalImageCategories: normalized.optionalImageCategories,
      hiddenImageCategories: normalized.hiddenImageCategories,
      imageTimestampRequired: normalized.imageTimestampRequired,
    },
    seal: {
      sealScanRequired: normalized.sealScanRequired,
      bulkSealGenerationEnabled: normalized.bulkSealGenerationEnabled,
      sealEditPolicy: normalizeSealEditPolicy(normalized.sealEditPolicy),
      sealEditRoles: normalized.sealEditRoles,
    },
    sampling: {
      containerTypeSource: normalizeContainerTypeSource(normalized.containerTypeSource),
      homogeneousProofRequired: normalized.homogeneousProofRequired,
      homogeneousWeightEnabled: false,
    },
    packet: {
      packetWeightRequired: true,
      packetPurposeMode: normalizePacketPurposeMode(normalized.packetPurposeMode),
    },
    approval: {
      holdRejectNotesMandatory: normalized.holdRejectNotesMandatory,
      notifyOnAssign: normalized.notifyOnAssign,
      notifyOnSubmit: normalized.notifyOnSubmit,
      notifyOnDecision: normalized.notifyOnDecision,
    },
    access: {
      allowedModuleIds: normalized.allowedModuleIds,
    },
    ui: {
      showOptionalImageSection: normalized.showOptionalImageSection,
      showBlockersInline: normalized.showBlockersInline,
    },
  };
}

export function fromModuleWorkflowPolicy(input: Partial<ModuleWorkflowPolicy> | null | undefined): FlatSettingsShape {
  return normalizeFlatSettings({
    creatorIsDefaultAssignee: input?.workflow?.creatorIsDefaultAssignee,
    deadlineRequired: input?.workflow?.deadlineRequired,
    decisionRequiredBeforeSampling: input?.workflow?.decisionRequiredBeforeSampling,
    submitToRndEnabled: input?.workflow?.submitToRndEnabled,
    allowJobCollaborators: input?.workflow?.allowJobCollaborators,
    autoLotNumbering: input?.workflow?.autoLotNumbering,
    lotNumberPrefix: input?.workflow?.lotNumberPrefix,
    lotNumberSequenceFormat: input?.workflow?.lotNumberSequenceFormat,
    autoSampleIdGeneration: input?.workflow?.autoSampleIdGeneration,
    sampleIdPrefix: input?.workflow?.sampleIdPrefix,
    sampleIdSequenceFormat: input?.workflow?.sampleIdSequenceFormat,
    autoPacketIdGeneration: input?.workflow?.autoPacketIdGeneration,
    packetIdPrefix: input?.workflow?.packetIdPrefix,
    packetIdSequenceFormat: input?.workflow?.packetIdSequenceFormat,
    finalDecisionApproverPolicy: input?.workflow?.finalDecisionApproverPolicy,
    lockPacketEditingAfterRndSubmit: input?.workflow?.lockPacketEditingAfterRndSubmit,
    sealScanRequired: input?.seal?.sealScanRequired,
    imageTimestampRequired: input?.images?.imageTimestampRequired,
    requiredImageCategories: input?.images?.requiredImageCategories,
    optionalImageCategories: input?.images?.optionalImageCategories,
    hiddenImageCategories: input?.images?.hiddenImageCategories,
    bulkSealGenerationEnabled: input?.seal?.bulkSealGenerationEnabled,
    sealEditPolicy: input?.seal?.sealEditPolicy,
    sealEditRoles: input?.seal?.sealEditRoles,
    containerTypeSource: input?.sampling?.containerTypeSource,
    homogeneousProofRequired: input?.sampling?.homogeneousProofRequired,
    packetPurposeMode: input?.packet?.packetPurposeMode,
    holdRejectNotesMandatory: input?.approval?.holdRejectNotesMandatory,
    notifyOnAssign: input?.approval?.notifyOnAssign,
    notifyOnSubmit: input?.approval?.notifyOnSubmit,
    notifyOnDecision: input?.approval?.notifyOnDecision,
    allowedModuleIds: input?.access?.allowedModuleIds,
    showOptionalImageSection: input?.ui?.showOptionalImageSection,
    showBlockersInline: input?.ui?.showBlockersInline,
  });
}

export function buildModuleWorkflowSettingsCreate(companyId: string) {
  return {
    companyId,
    ...defaultModuleWorkflowSettings,
  };
}

export function buildModuleWorkflowSettingsUpdate(input: Partial<ModuleWorkflowPolicy> | null | undefined) {
  return fromModuleWorkflowPolicy(input);
}

export function canApproveFinalDecision(
  role: "ADMIN" | "VIEWER" | "OPERATIONS" | "RND" | string | undefined,
  policy: FinalDecisionApproverPolicy,
) {
  if (policy === "ADMIN") {
    return role === "ADMIN";
  }
  if (policy === "MANAGER") {
    return role === "VIEWER";
  }
  return role === "ADMIN" || role === "VIEWER";
}

export function canEditSeal(role: "ADMIN" | "VIEWER" | "OPERATIONS" | "RND" | string | undefined, policy: SealEditPolicy) {
  return canEditSealWithRoles(role, policy, []);
}

export function canEditSealWithRoles(
  role: "ADMIN" | "VIEWER" | "OPERATIONS" | "RND" | string | undefined,
  policy: SealEditPolicy,
  allowedRoles: string[] | undefined,
) {
  const normalizedRole = typeof role === "string" ? role.toUpperCase() : "";
  const normalizedAllowedRoles = Array.isArray(allowedRoles) ? allowedRoles.map((value) => value.toUpperCase()) : [];

  if (normalizedAllowedRoles.length > 0) {
    return normalizedAllowedRoles.includes(normalizedRole);
  }

  if (policy === "ADMIN_ONLY") {
    return normalizedRole === "ADMIN";
  }
  return normalizedRole === "ADMIN" || normalizedRole === "OPERATIONS" || normalizedRole === "VIEWER";
}
