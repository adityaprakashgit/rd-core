import type { InspectionBag, InspectionJob, InspectionLot, InspectionMediaCategory, InspectionMediaFile } from "@/types/inspection";
import { LOT_INTAKE_OPTIONAL_MEDIA_CATEGORIES, LOT_INTAKE_REQUIRED_MEDIA_CATEGORIES } from "@/lib/evidence-definition";
import { getStatusPresentation } from "@/lib/status-presentation";

export const REQUIRED_LOT_MEDIA_CATEGORIES = [
  ...LOT_INTAKE_REQUIRED_MEDIA_CATEGORIES,
] as const satisfies readonly InspectionMediaCategory[];

export const OPTIONAL_LOT_MEDIA_CATEGORIES = [
  ...LOT_INTAKE_OPTIONAL_MEDIA_CATEGORIES,
] as const satisfies readonly InspectionMediaCategory[];

export type LotIntakeStatus =
  | "CREATED"
  | "DETAILS_CAPTURED"
  | "MEDIA_PENDING"
  | "SAMPLING_CAPTURED"
  | "SEALED"
  | "READY_FOR_NEXT_STAGE";

export function normalizeQuantityMode(value: string | null | undefined): "SINGLE_PIECE" | "MULTI_WEIGHT" {
  return value === "MULTI_WEIGHT" ? "MULTI_WEIGHT" : "SINGLE_PIECE";
}

function normalizeCategory(value: string): InspectionMediaCategory | string {
  switch (value) {
    case "BAG":
      return "BAG_WITH_LOT_NO";
    case "SEAL":
      return "SEALED_BAG";
    case "DURING":
      return "SAMPLING_IN_PROGRESS";
    default:
      return value;
  }
}

function buildSyntheticMediaFile(
  lot: InspectionLot,
  category: InspectionMediaCategory,
  storageKey: string,
): InspectionMediaFile {
  return {
    id: `legacy-${lot.id}-${category}`,
    lotId: lot.id,
    category,
    storageKey,
    fileName: storageKey.split("/").pop() ?? `${category.toLowerCase()}.jpg`,
    createdAt: lot.updatedAt ?? lot.createdAt,
  };
}

export function getLotMediaFiles(lot: InspectionLot | null | undefined): InspectionMediaFile[] {
  if (!lot) {
    return [];
  }

  const declared = (lot.mediaFiles ?? []).map((file) => ({
    ...file,
    category: normalizeCategory(file.category),
  }));
  const byCategory = new Map<string, InspectionMediaFile>();

  for (const file of declared) {
    if (!byCategory.has(file.category)) {
      byCategory.set(file.category, file);
    }
  }

  if (lot.bagPhotoUrl && !byCategory.has("BAG_WITH_LOT_NO")) {
    byCategory.set("BAG_WITH_LOT_NO", buildSyntheticMediaFile(lot, "BAG_WITH_LOT_NO", lot.bagPhotoUrl));
  }

  if (lot.samplingPhotoUrl && !byCategory.has("SAMPLING_IN_PROGRESS")) {
    byCategory.set("SAMPLING_IN_PROGRESS", buildSyntheticMediaFile(lot, "SAMPLING_IN_PROGRESS", lot.samplingPhotoUrl));
  }

  if (lot.sealPhotoUrl && !byCategory.has("SEALED_BAG")) {
    byCategory.set("SEALED_BAG", buildSyntheticMediaFile(lot, "SEALED_BAG", lot.sealPhotoUrl));
  }

  return Array.from(byCategory.values());
}

export function getCapturedLotMediaCategories(lot: InspectionLot | null | undefined): Set<string> {
  return new Set(getLotMediaFiles(lot).map((file) => file.category));
}

export function getLotPhotoCompletion(lot: InspectionLot | null | undefined) {
  const captured = getCapturedLotMediaCategories(lot);
  const requiredCompleted = REQUIRED_LOT_MEDIA_CATEGORIES.filter((category) => captured.has(category)).length;
  const optionalCompleted = OPTIONAL_LOT_MEDIA_CATEGORIES.filter((category) => captured.has(category)).length;
  return {
    requiredCompleted,
    requiredTotal: REQUIRED_LOT_MEDIA_CATEGORIES.length,
    optionalCompleted,
    optionalTotal: OPTIONAL_LOT_MEDIA_CATEGORIES.length,
    totalCompleted: requiredCompleted + optionalCompleted,
    totalTarget: REQUIRED_LOT_MEDIA_CATEGORIES.length + OPTIONAL_LOT_MEDIA_CATEGORIES.length,
    isComplete: requiredCompleted === REQUIRED_LOT_MEDIA_CATEGORIES.length,
  };
}

export function isLotDetailCaptured(lot: InspectionLot | null | undefined): boolean {
  if (!lot || !lot.lotNumber || !(lot.materialName ?? "").trim()) {
    return false;
  }

  const quantityMode = normalizeQuantityMode(lot.quantityMode);
  if (quantityMode === "MULTI_WEIGHT") {
    return true;
  }

  return Boolean(
    (lot.bagCount ?? 0) > 0 ||
    (lot.pieceCount ?? 0) > 0 ||
    lot.grossWeight !== null && lot.grossWeight !== undefined ||
    lot.netWeight !== null && lot.netWeight !== undefined,
  );
}

export function getLotWeightRows(lot: InspectionLot | null | undefined): InspectionBag[] {
  return lot?.bags ?? [];
}

export function isLotQuantityCaptured(lot: InspectionLot | null | undefined): boolean {
  if (!lot) {
    return false;
  }

  const quantityMode = normalizeQuantityMode(lot.quantityMode);
  if (quantityMode === "MULTI_WEIGHT") {
    const weightRows = getLotWeightRows(lot);
    return weightRows.length > 0 && weightRows.every((bag) => bag.grossWeight !== null && bag.grossWeight !== undefined);
  }

  return Boolean(
    (lot.bagCount ?? 0) > 0 ||
    (lot.pieceCount ?? 0) > 0 ||
    lot.grossWeight !== null && lot.grossWeight !== undefined ||
    lot.netWeight !== null && lot.netWeight !== undefined,
  );
}

export function isLotReadyForNextStage(lot: InspectionLot | null | undefined): boolean {
  return isLotDetailCaptured(lot) && isLotQuantityCaptured(lot) && getLotPhotoCompletion(lot).isComplete;
}

export function getLotIntakeStatus(lot: InspectionLot | null | undefined): LotIntakeStatus {
  if (!lot) {
    return "CREATED";
  }

  if (isLotReadyForNextStage(lot)) {
    return "READY_FOR_NEXT_STAGE";
  }

  const quantityCaptured = isLotQuantityCaptured(lot);
  const photoCategories = getCapturedLotMediaCategories(lot);

  if (photoCategories.has("SEALED_BAG")) {
    return "SEALED";
  }

  if (photoCategories.has("SAMPLING_IN_PROGRESS")) {
    return "SAMPLING_CAPTURED";
  }

  if (isLotDetailCaptured(lot) && quantityCaptured) {
    return "MEDIA_PENDING";
  }

  if (isLotDetailCaptured(lot)) {
    return "DETAILS_CAPTURED";
  }

  return "CREATED";
}

export function getLotIntakeStatusPresentation(lot: InspectionLot | null | undefined) {
  const status = getLotIntakeStatus(lot);
  const presentation = getStatusPresentation(status);
  return { status, label: presentation.label, tone: presentation.tone };
}

export function getLotModeLabel(lot: InspectionLot | null | undefined): string {
  return normalizeQuantityMode(lot?.quantityMode) === "MULTI_WEIGHT" ? "Multi Weight" : "Single Piece";
}

export function getLotQuantitySummary(lot: InspectionLot | null | undefined): string {
  if (!lot) {
    return "No quantity data";
  }

  const quantityMode = normalizeQuantityMode(lot.quantityMode);
  const weightUnit = lot.weightUnit?.trim() || "kg";

  if (quantityMode === "MULTI_WEIGHT") {
    const rows = getLotWeightRows(lot);
    return rows.length > 0 ? `${rows.length} weight entr${rows.length === 1 ? "y" : "ies"}` : "Weights pending";
  }

  const countLabel = (lot.bagCount ?? 0) > 0
    ? `${lot.bagCount} bag${lot.bagCount === 1 ? "" : "s"}`
    : (lot.pieceCount ?? 0) > 0
      ? `${lot.pieceCount} piece${lot.pieceCount === 1 ? "" : "s"}`
      : "Count pending";

  const weightLabel = lot.netWeight ?? lot.grossWeight;
  return weightLabel !== null && weightLabel !== undefined
    ? `${countLabel} • ${weightLabel} ${weightUnit}`
    : countLabel;
}

export function summarizeJobIntake(job: InspectionJob) {
  const lots = job.lots ?? [];
  const completed = lots.filter((lot) => isLotReadyForNextStage(lot)).length;
  const started = lots.filter((lot) => isLotDetailCaptured(lot) || getLotMediaFiles(lot).length > 0).length;

  return {
    total: lots.length,
    completed,
    inProgress: Math.max(started - completed, 0),
    pending: Math.max(lots.length - started, 0),
  };
}
