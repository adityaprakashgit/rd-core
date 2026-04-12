import type { InspectionLot } from "@/types/inspection";

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

    const inspectionStatus = lot.inspection?.inspectionStatus ?? "";
    const decisionStatus = lot.inspection?.decisionStatus ?? "";

    if (inspectionStatus !== "COMPLETED") {
      return {
        lotId: lot.id,
        lotNumber,
        eligible: false,
        reason: "Inspection not completed.",
        alreadyAssigned: false,
      };
    }

    if (decisionStatus !== "READY_FOR_SAMPLING") {
      return {
        lotId: lot.id,
        lotNumber,
        eligible: false,
        reason: "Final decision must be Pass (Ready for Sampling).",
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
