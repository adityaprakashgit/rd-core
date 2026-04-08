export type DuplicateJobCandidate = {
  id: string;
  inspectionSerialNumber: string;
  jobReferenceNumber: string | null;
  clientName: string;
  commodity: string;
  plantLocation: string | null;
  status: string;
  createdAt: Date;
};

export type DuplicateOverrideDecision =
  | {
      kind: "PROCEED";
      duplicateCount: number;
      overrideUsed: false;
      auditMetadata: {
        duplicateCandidateCount: number;
        duplicateCandidateIds: string[];
        duplicateCheckWindowHours: number;
        duplicateOverride: false;
        duplicateOverrideReason: null;
      };
    }
  | {
      kind: "BLOCK_DUPLICATE";
      duplicateWindowHours: number;
      duplicates: DuplicateJobCandidate[];
      canOverrideDuplicate: boolean;
    }
  | {
      kind: "VALIDATION_ERROR";
      message: string;
    }
  | {
      kind: "FORBIDDEN_OVERRIDE";
      message: string;
    }
  | {
      kind: "ALLOW_OVERRIDE";
      duplicateCount: number;
      overrideReason: string;
      auditMetadata: {
        duplicateCandidateCount: number;
        duplicateCandidateIds: string[];
        duplicateCheckWindowHours: number;
        duplicateOverride: true;
        duplicateOverrideReason: string;
      };
    };

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function evaluateDuplicateOverrideDecision(input: {
  duplicates: DuplicateJobCandidate[];
  duplicateWindowHours: number;
  overrideDuplicate: boolean;
  overrideReason: unknown;
  userRole: string;
}): DuplicateOverrideDecision {
  const duplicateCount = input.duplicates.length;
  const duplicateCandidateIds = input.duplicates.map((candidate) => candidate.id);

  if (duplicateCount === 0) {
    return {
      kind: "PROCEED",
      duplicateCount,
      overrideUsed: false,
      auditMetadata: {
        duplicateCandidateCount: 0,
        duplicateCandidateIds: [],
        duplicateCheckWindowHours: input.duplicateWindowHours,
        duplicateOverride: false,
        duplicateOverrideReason: null,
      },
    };
  }

  if (!input.overrideDuplicate) {
    return {
      kind: "BLOCK_DUPLICATE",
      duplicateWindowHours: input.duplicateWindowHours,
      duplicates: input.duplicates,
      canOverrideDuplicate: input.userRole === "ADMIN",
    };
  }

  const reason = normalizeText(input.overrideReason);
  if (!reason) {
    return {
      kind: "VALIDATION_ERROR",
      message: "overrideReason is required when overrideDuplicate is true.",
    };
  }

  if (input.userRole !== "ADMIN") {
    return {
      kind: "FORBIDDEN_OVERRIDE",
      message: "Only admins can override duplicate warnings.",
    };
  }

  return {
    kind: "ALLOW_OVERRIDE",
    duplicateCount,
    overrideReason: reason,
    auditMetadata: {
      duplicateCandidateCount: duplicateCount,
      duplicateCandidateIds,
      duplicateCheckWindowHours: input.duplicateWindowHours,
      duplicateOverride: true,
      duplicateOverrideReason: reason,
    },
  };
}
