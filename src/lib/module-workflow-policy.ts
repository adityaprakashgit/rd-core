import type { ModuleWorkflowSettings } from "@prisma/client";

export type FinalDecisionApproverPolicy = "MANAGER" | "ADMIN" | "MANAGER_ADMIN";
export type SealEditPolicy = "ADMIN_ONLY" | "ALLOWED";
export type ContainerTypeSource = "MASTER_ONLY";
export type PacketPurposeMode = "OPTIONAL" | "RND_OWNED";

export type ModuleWorkflowPolicy = {
  workflow: {
    autoLotNumbering: boolean;
    lotNumberPrefix: string;
    lotNumberSequenceFormat: string;
    autoSampleIdGeneration: boolean;
    sampleIdPrefix: string;
    sampleIdSequenceFormat: string;
    finalDecisionApproverPolicy: FinalDecisionApproverPolicy;
    lockPacketEditingAfterRndSubmit: boolean;
  };
  images: {
    requiredImageCategories: string[];
    optionalImageCategories: string[];
    imageTimestampRequired: boolean;
  };
  seal: {
    sealScanRequired: boolean;
    bulkSealGenerationEnabled: boolean;
    sealEditPolicy: SealEditPolicy;
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
  ui: {
    showOptionalImageSection: boolean;
    showBlockersInline: boolean;
  };
};

type FlatSettingsShape = {
  autoLotNumbering: boolean;
  lotNumberPrefix: string | null;
  lotNumberSequenceFormat: string | null;
  autoSampleIdGeneration: boolean;
  sampleIdPrefix: string | null;
  sampleIdSequenceFormat: string | null;
  finalDecisionApproverPolicy: string;
  lockPacketEditingAfterRndSubmit: boolean;
  sealScanRequired: boolean;
  imageTimestampRequired: boolean;
  requiredImageCategories: string[];
  optionalImageCategories: string[];
  bulkSealGenerationEnabled: boolean;
  sealEditPolicy: string;
  containerTypeSource: string;
  homogeneousProofRequired: boolean;
  packetPurposeMode: string;
  showOptionalImageSection: boolean;
  showBlockersInline: boolean;
};

export const defaultModuleWorkflowSettings: FlatSettingsShape = {
  autoLotNumbering: false,
  lotNumberPrefix: "LOT",
  lotNumberSequenceFormat: "0001",
  autoSampleIdGeneration: true,
  sampleIdPrefix: "SMP",
  sampleIdSequenceFormat: "0001",
  finalDecisionApproverPolicy: "MANAGER_ADMIN",
  lockPacketEditingAfterRndSubmit: true,
  sealScanRequired: true,
  imageTimestampRequired: false,
  requiredImageCategories: [
    "Bag photo with visible LOT no",
    "Material in bag",
    "During Sampling Photo",
    "Sample Completion",
    "Seal on bag",
    "Bag condition",
  ],
  optionalImageCategories: ["Whole Job bag palletized and packed"],
  bulkSealGenerationEnabled: true,
  sealEditPolicy: "ADMIN_ONLY",
  containerTypeSource: "MASTER_ONLY",
  homogeneousProofRequired: true,
  packetPurposeMode: "OPTIONAL",
  showOptionalImageSection: true,
  showBlockersInline: true,
};

function normalizeStringArray(values: unknown, fallback: string[]) {
  if (!Array.isArray(values)) {
    return fallback;
  }
  const normalized = values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  return normalized.length > 0 ? normalized : fallback;
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

function normalizeFlatSettings(value: Partial<FlatSettingsShape> | null | undefined): FlatSettingsShape {
  return {
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
    finalDecisionApproverPolicy: normalizeApproverPolicy(value?.finalDecisionApproverPolicy),
    lockPacketEditingAfterRndSubmit:
      value?.lockPacketEditingAfterRndSubmit ?? defaultModuleWorkflowSettings.lockPacketEditingAfterRndSubmit,
    sealScanRequired: value?.sealScanRequired ?? defaultModuleWorkflowSettings.sealScanRequired,
    imageTimestampRequired: value?.imageTimestampRequired ?? defaultModuleWorkflowSettings.imageTimestampRequired,
    requiredImageCategories: normalizeStringArray(value?.requiredImageCategories, defaultModuleWorkflowSettings.requiredImageCategories),
    optionalImageCategories: normalizeStringArray(value?.optionalImageCategories, defaultModuleWorkflowSettings.optionalImageCategories),
    bulkSealGenerationEnabled: value?.bulkSealGenerationEnabled ?? defaultModuleWorkflowSettings.bulkSealGenerationEnabled,
    sealEditPolicy: normalizeSealEditPolicy(value?.sealEditPolicy),
    containerTypeSource: normalizeContainerTypeSource(value?.containerTypeSource),
    homogeneousProofRequired: value?.homogeneousProofRequired ?? defaultModuleWorkflowSettings.homogeneousProofRequired,
    packetPurposeMode: normalizePacketPurposeMode(value?.packetPurposeMode),
    showOptionalImageSection: value?.showOptionalImageSection ?? defaultModuleWorkflowSettings.showOptionalImageSection,
    showBlockersInline: value?.showBlockersInline ?? defaultModuleWorkflowSettings.showBlockersInline,
  };
}

export function toModuleWorkflowPolicy(value: Partial<FlatSettingsShape> | ModuleWorkflowSettings | null | undefined): ModuleWorkflowPolicy {
  const normalized = normalizeFlatSettings(value ?? undefined);
  return {
    workflow: {
      autoLotNumbering: normalized.autoLotNumbering,
      lotNumberPrefix: normalized.lotNumberPrefix ?? defaultModuleWorkflowSettings.lotNumberPrefix ?? "LOT",
      lotNumberSequenceFormat: normalized.lotNumberSequenceFormat ?? defaultModuleWorkflowSettings.lotNumberSequenceFormat ?? "0001",
      autoSampleIdGeneration: normalized.autoSampleIdGeneration,
      sampleIdPrefix: normalized.sampleIdPrefix ?? defaultModuleWorkflowSettings.sampleIdPrefix ?? "SMP",
      sampleIdSequenceFormat: normalized.sampleIdSequenceFormat ?? defaultModuleWorkflowSettings.sampleIdSequenceFormat ?? "0001",
      finalDecisionApproverPolicy: normalizeApproverPolicy(normalized.finalDecisionApproverPolicy),
      lockPacketEditingAfterRndSubmit: normalized.lockPacketEditingAfterRndSubmit,
    },
    images: {
      requiredImageCategories: normalized.requiredImageCategories,
      optionalImageCategories: normalized.optionalImageCategories,
      imageTimestampRequired: normalized.imageTimestampRequired,
    },
    seal: {
      sealScanRequired: normalized.sealScanRequired,
      bulkSealGenerationEnabled: normalized.bulkSealGenerationEnabled,
      sealEditPolicy: normalizeSealEditPolicy(normalized.sealEditPolicy),
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
    ui: {
      showOptionalImageSection: normalized.showOptionalImageSection,
      showBlockersInline: normalized.showBlockersInline,
    },
  };
}

export function fromModuleWorkflowPolicy(input: Partial<ModuleWorkflowPolicy> | null | undefined): FlatSettingsShape {
  return normalizeFlatSettings({
    autoLotNumbering: input?.workflow?.autoLotNumbering,
    lotNumberPrefix: input?.workflow?.lotNumberPrefix,
    lotNumberSequenceFormat: input?.workflow?.lotNumberSequenceFormat,
    autoSampleIdGeneration: input?.workflow?.autoSampleIdGeneration,
    sampleIdPrefix: input?.workflow?.sampleIdPrefix,
    sampleIdSequenceFormat: input?.workflow?.sampleIdSequenceFormat,
    finalDecisionApproverPolicy: input?.workflow?.finalDecisionApproverPolicy,
    lockPacketEditingAfterRndSubmit: input?.workflow?.lockPacketEditingAfterRndSubmit,
    sealScanRequired: input?.seal?.sealScanRequired,
    imageTimestampRequired: input?.images?.imageTimestampRequired,
    requiredImageCategories: input?.images?.requiredImageCategories,
    optionalImageCategories: input?.images?.optionalImageCategories,
    bulkSealGenerationEnabled: input?.seal?.bulkSealGenerationEnabled,
    sealEditPolicy: input?.seal?.sealEditPolicy,
    containerTypeSource: input?.sampling?.containerTypeSource,
    homogeneousProofRequired: input?.sampling?.homogeneousProofRequired,
    packetPurposeMode: input?.packet?.packetPurposeMode,
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
  if (policy === "ADMIN_ONLY") {
    return role === "ADMIN";
  }
  return role === "ADMIN" || role === "OPERATIONS" || role === "VIEWER";
}
