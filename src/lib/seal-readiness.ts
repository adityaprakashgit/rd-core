import type { InspectionLot } from "@/types/inspection";
import { normalizeEvidenceCategoryKey } from "@/lib/evidence-definition";

export type SealReadinessRow = {
  lotId: string;
  lotNumber: string;
  eligible: boolean;
  reason: string;
  alreadyAssigned: boolean;
};

export function buildSealReadinessRows(lots: InspectionLot[] | null | undefined): SealReadinessRow[] {
  return (lots ?? []).map((lot) => {
    const lotNumber = lot.lotNumber || "Unknown lot";
    const assignedSeal = lot.sample?.sealLabel?.sealNo ?? lot.sealNumber;

    if (assignedSeal) {
      return {
        lotId: lot.id,
        lotNumber,
        eligible: false,
        reason: "Seal already assigned.",
        alreadyAssigned: true,
      };
    }

    const hasBagProofCategory = (lot.mediaFiles ?? []).some((file) => normalizeEvidenceCategoryKey(file.category) === "BAG_WITH_LOT_NO");
    const hasBagProof = hasBagProofCategory || Boolean(lot.bagPhotoUrl);
    if (!hasBagProof) {
      return {
        lotId: lot.id,
        lotNumber,
        eligible: false,
        reason: "Bag proof is required before seal assignment.",
        alreadyAssigned: false,
      };
    }

    return {
      lotId: lot.id,
      lotNumber,
      eligible: true,
      reason: "Ready for generation.",
      alreadyAssigned: false,
    };
  });
}
