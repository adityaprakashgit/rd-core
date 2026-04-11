import {
  getEvidenceCategoryLabel,
  normalizeEvidenceCategoryKey,
  type CanonicalEvidenceCategory,
} from "@/lib/evidence-definition";

export function resolveRequiredImageUploadCategories(requiredImageCategories: string[]) {
  return Array.from(
    new Set(
      requiredImageCategories
        .map((entry) => normalizeEvidenceCategoryKey(entry))
        .filter((category): category is CanonicalEvidenceCategory => Boolean(category)),
    ),
  );
}

type EvidenceResolverInput = {
  lot?: {
    bagPhotoUrl?: string | null;
    samplingPhotoUrl?: string | null;
    sealPhotoUrl?: string | null;
  } | null;
  inspectionMedia?: Array<{ category?: string | null }> | null;
  lotMedia?: Array<{ category?: string | null }> | null;
};

export function resolveEvidenceCategoriesForLot(input: EvidenceResolverInput): Set<CanonicalEvidenceCategory> {
  const categories = new Set<CanonicalEvidenceCategory>();

  const addCategory = (raw: unknown) => {
    const normalized = normalizeEvidenceCategoryKey(raw);
    if (normalized) {
      categories.add(normalized);
    }
  };

  for (const media of input.inspectionMedia ?? []) {
    addCategory(media?.category);
  }

  for (const media of input.lotMedia ?? []) {
    addCategory(media?.category);
  }

  if (input.lot?.bagPhotoUrl) {
    categories.add("BAG_WITH_LOT_NO");
  }
  if (input.lot?.samplingPhotoUrl) {
    categories.add("SAMPLING_IN_PROGRESS");
  }
  if (input.lot?.sealPhotoUrl) {
    categories.add("SEALED_BAG");
  }

  return categories;
}

export function resolveMissingRequiredEvidenceCategories(
  requiredImageCategories: string[],
  resolvedCategories: Set<CanonicalEvidenceCategory>,
) {
  const required = resolveRequiredImageUploadCategories(requiredImageCategories);
  return required.filter((category) => !resolvedCategories.has(category));
}

export function getMissingRequiredImageProofLabels(
  requiredImageCategories: string[],
  uploadedMediaCategories: string[],
) {
  const uploaded = new Set<CanonicalEvidenceCategory>(
    uploadedMediaCategories
      .map((category) => normalizeEvidenceCategoryKey(category))
      .filter((category): category is CanonicalEvidenceCategory => Boolean(category)),
  );
  return resolveMissingRequiredEvidenceCategories(requiredImageCategories, uploaded).map((category) =>
    getEvidenceCategoryLabel(category),
  );
}

export function getRequiredProofFailureCode(missingCategories: CanonicalEvidenceCategory[]) {
  if (missingCategories.includes("BAG_WITH_LOT_NO")) {
    return "PROOF_REQUIRED_MISSING_BAG";
  }
  if (missingCategories.includes("SAMPLING_IN_PROGRESS")) {
    return "PROOF_REQUIRED_MISSING_SAMPLING";
  }
  if (missingCategories.includes("SEALED_BAG") || missingCategories.includes("SEAL_CLOSEUP")) {
    return "PROOF_REQUIRED_MISSING_SEAL";
  }
  return "PROOF_REQUIRED_MISSING_CATEGORY";
}

export function requiresRequiredImageProofForDecision(decisionStatus: string | null | undefined) {
  return decisionStatus === "PENDING" || decisionStatus === "READY_FOR_SAMPLING";
}
