import type { SampleMediaRecord, SampleRecord } from "@/types/inspection";
import {
  REQUIRED_SAMPLE_MEDIA_TYPES,
  SAMPLE_EVIDENCE_ITEMS,
  getWorkflowEvidenceGroupForCategory,
} from "@/lib/evidence-definition";

export type SampleReadinessLevel = "batch" | "bag" | "sample-packet";

export type SampleReadinessContext = {
  lotSealNumber?: string | null;
  lotSealNumbers?: Array<string | null | undefined>;
};

export type SampleReadinessBlocker = {
  key: string;
  level: SampleReadinessLevel;
  groupTitle: string;
  proofLabel: string;
  locationLabel: string;
  actionLabel: string;
  detail: string;
};

export const SAMPLE_STATUSES = [
  "CREATED",
  "SAMPLING_IN_PROGRESS",
  "DETAILS_CAPTURED",
  "HOMOGENIZED",
  "SEALED",
  "READY_FOR_PACKETING",
] as const;

export const SAMPLE_MEDIA_TYPES = [
  "SAMPLING_IN_PROGRESS",
  "SAMPLE_CONTAINER",
  "SAMPLE_LABEL",
  "SEALED_SAMPLE",
  "HOMOGENIZED_SAMPLE",
  "SAMPLE_CONDITION",
] as const;

export type SampleStatus = (typeof SAMPLE_STATUSES)[number];
export type SampleMediaType = (typeof SAMPLE_MEDIA_TYPES)[number];

const readinessMediaRequirements: SampleMediaType[] = [...REQUIRED_SAMPLE_MEDIA_TYPES];

function hasLotSealTraceability(context?: SampleReadinessContext) {
  if (Array.isArray(context?.lotSealNumbers) && context.lotSealNumbers.length > 0) {
    return context.lotSealNumbers.every((sealNumber) => Boolean(sealNumber?.trim()));
  }

  return Boolean(context?.lotSealNumber?.trim());
}

export function normalizeSampleMediaType(value: unknown): SampleMediaType | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return SAMPLE_MEDIA_TYPES.includes(normalized as SampleMediaType)
    ? (normalized as SampleMediaType)
    : null;
}

export function mapSampleMediaByType(media: SampleMediaRecord[] | null | undefined) {
  return (media ?? []).reduce<Partial<Record<SampleMediaType, SampleMediaRecord>>>((acc, item) => {
    const mediaType = normalizeSampleMediaType(item.mediaType);
    if (!mediaType) {
      return acc;
    }

    const existing = acc[mediaType];
    if (!existing || new Date(item.capturedAt).getTime() >= new Date(existing.capturedAt).getTime()) {
      acc[mediaType] = item;
    }
    return acc;
  }, {});
}

export function hasSampleDetails(sample: SampleRecord | null | undefined) {
  return Boolean(
    sample?.sampleType &&
      sample.samplingMethod &&
      typeof sample.sampleQuantity === "number" &&
      sample.sampleQuantity > 0 &&
      sample.sampleUnit &&
      sample.containerType,
  );
}

export function hasHomogenizedSample(sample: SampleRecord | null | undefined) {
  return Boolean(sample?.homogenizedAt);
}

export function hasSealAndLabel(sample: SampleRecord | null | undefined, context?: SampleReadinessContext) {
  const mediaMap = mapSampleMediaByType(sample?.media);
  const hasPhoto = Boolean(mediaMap["SEALED_SAMPLE"]?.fileUrl || mediaMap["HOMOGENIZED_SAMPLE"]?.fileUrl);
  return Boolean(
    (sample?.sealLabel?.sealNo || hasLotSealTraceability(context)) &&
      (sample?.sealLabel?.sealedAt || hasLotSealTraceability(context)) &&
      hasPhoto,
  );
}

export function getRequiredMissingMedia(sample: SampleRecord | null | undefined) {
  const mediaMap = mapSampleMediaByType(sample?.media);
  return readinessMediaRequirements.filter((type) => !mediaMap[type]?.fileUrl);
}

export function getSampleReadinessBlockers(sample: SampleRecord | null | undefined, context?: SampleReadinessContext): SampleReadinessBlocker[] {
  const blockers: SampleReadinessBlocker[] = [];
  const mediaMap = mapSampleMediaByType(sample?.media);
  const hasLotSeal = hasLotSealTraceability(context);

  if (!sample) {
    blockers.push(
      {
        key: "sample-not-started",
        level: "batch",
        groupTitle: "Batch evidence",
        proofLabel: "Sample record",
        locationLabel: "Homogeneous Sampling > Step 1 Start sampling",
        actionLabel: "Start sampling",
        detail: "Batch evidence: Sample record has not been started. Start sampling in Homogeneous Sampling > Step 1 Start sampling.",
      },
    );
    return blockers;
  }

  if (!hasSampleDetails(sample)) {
    blockers.push(
      {
        key: "sample-details",
        level: "batch",
        groupTitle: "Batch evidence",
        proofLabel: "Sample details",
        locationLabel: "Homogeneous Sampling > Step 2 Sample details",
        actionLabel: "Save details",
        detail:
          "Batch evidence: Sample details are incomplete. Capture sample type, sampling method, quantity, unit, and container in Homogeneous Sampling > Step 2 Sample details.",
      },
    );
  }

  const missingMedia = getRequiredMissingMedia(sample);
  const homogeneousMedia = SAMPLE_EVIDENCE_ITEMS.find((item) => item.mediaType === "HOMOGENIZED_SAMPLE");
  if (missingMedia.includes("HOMOGENIZED_SAMPLE") && homogeneousMedia) {
    const group = getWorkflowEvidenceGroupForCategory(homogeneousMedia.uploadCategory);
    blockers.push(
      {
        key: "homogeneous-sample-photo",
        level: group?.scope === "sample-packet" ? "sample-packet" : "bag",
        groupTitle: group?.title ?? "Sample packet evidence",
        proofLabel: homogeneousMedia.title,
        locationLabel: "Homogeneous Sampling > Step 3 Capture proof",
        actionLabel: "Upload proof",
        detail:
          "Sample packet evidence: Homogeneous sample making photo is missing. Upload it in Homogeneous Sampling > Step 3 Capture proof.",
      },
    );
  }

  if (!hasHomogenizedSample(sample)) {
    blockers.push(
      {
        key: "homogenized-state",
        level: "sample-packet",
        groupTitle: "Sample packet evidence",
        proofLabel: "Homogeneous confirmation",
        locationLabel: "Homogeneous Sampling > Step 4 Homogenize",
        actionLabel: "Mark homogenized",
        detail:
          "Sample packet evidence: Homogeneous confirmation is missing. Mark the sample homogenized in Homogeneous Sampling > Step 4 Homogenize.",
      },
    );
  }

  const sealMedia = SAMPLE_EVIDENCE_ITEMS.find((item) => item.mediaType === "SEALED_SAMPLE");
  if (sealMedia) {
    const group = getWorkflowEvidenceGroupForCategory(sealMedia.uploadCategory);
    const hasSealNumber = Boolean(sample.sealLabel?.sealNo?.trim() || hasLotSeal);
    const hasSealTimestamp = Boolean(
      sample.sealLabel?.sealedAt || hasLotSeal || mediaMap["SEALED_SAMPLE"]?.fileUrl || mediaMap["HOMOGENIZED_SAMPLE"]?.fileUrl,
    );

    if (!hasSealNumber) {
      blockers.push(
        {
          key: "seal-number",
          level: group?.scope === "bag" ? "bag" : "sample-packet",
          groupTitle: group?.title ?? "Bag evidence",
          proofLabel: "Seal number",
          locationLabel: "Seal Evidence > Seal number",
          actionLabel: "Save seal",
          detail:
            "Bag evidence: Seal number is missing. Enter it in Seal Evidence.",
        },
      );
    }

    if (!hasSealTimestamp) {
      blockers.push(
        {
          key: "sealed-sample-photo",
          level: group?.scope === "bag" ? "bag" : "sample-packet",
          groupTitle: group?.title ?? "Bag evidence",
          proofLabel: "Homogeneous proof photo",
          locationLabel: "Homogeneous Sampling > Step 3 Capture proof",
          actionLabel: "Upload proof",
          detail:
            "Bag evidence: Homogeneous proof photo is missing. Upload it in Homogeneous Sampling > Step 3 Capture proof with the seal number visible.",
        },
      );
    }
  }

  return blockers;
}

export function getSampleReadiness(sample: SampleRecord | null | undefined, context?: SampleReadinessContext) {
  const blockers = getSampleReadinessBlockers(sample, context);
  const missing = blockers.map((blocker) => blocker.detail);

  return {
    isReady: missing.length === 0,
    missing,
    blockers,
  };
}

export function isInspectionReadyForSampling(input: {
  inspectionStatus?: string | null;
  decisionStatus?: string | null;
} | null | undefined) {
  return input?.inspectionStatus === "COMPLETED" && input?.decisionStatus === "READY_FOR_SAMPLING";
}

export function getSamplingReadinessInvariantError(input: {
  inspectionStatus?: string | null;
  decisionStatus?: string | null;
} | null | undefined) {
  if (input?.decisionStatus === "READY_FOR_SAMPLING" && input.inspectionStatus !== "COMPLETED") {
    return "READY_FOR_SAMPLING_REQUIRES_COMPLETED_INSPECTION";
  }

  return null;
}

export function getInspectionSamplingDisplayStatus(input: {
  inspectionStatus?: string | null;
  decisionStatus?: string | null;
  samplingBlockedFlag?: boolean | null;
} | null | undefined) {
  if (!input) {
    return "PENDING";
  }

  if (input.decisionStatus === "ON_HOLD" || input.decisionStatus === "REJECTED") {
    return input.decisionStatus;
  }

  if (isInspectionReadyForSampling(input) && input.samplingBlockedFlag !== true) {
    return "READY_FOR_SAMPLING";
  }

  if (input.samplingBlockedFlag === true) {
    return "BLOCKED";
  }

  if (input.inspectionStatus === "COMPLETED") {
    return "COMPLETED";
  }

  if (input.inspectionStatus === "IN_PROGRESS") {
    return "INSPECTION_IN_PROGRESS";
  }

  return "PENDING";
}

export function deriveSampleStatus(sample: SampleRecord | null | undefined): SampleStatus {
  return deriveSampleStatusWithContext(sample, undefined);
}

export function deriveSampleStatusWithContext(
  sample: SampleRecord | null | undefined,
  context?: SampleReadinessContext,
): SampleStatus {
  if (!sample) {
    return "CREATED";
  }

  const readiness = getSampleReadiness(sample, context);
  if (readiness.isReady || sample.sampleStatus === "READY_FOR_PACKETING") {
    return "READY_FOR_PACKETING";
  }

  if (hasSealAndLabel(sample, context) || sample.sampleStatus === "SEALED") {
    return "SEALED";
  }

  if (hasHomogenizedSample(sample) || sample.sampleStatus === "HOMOGENIZED") {
    return "HOMOGENIZED";
  }

  if (hasSampleDetails(sample) || sample.sampleStatus === "DETAILS_CAPTURED") {
    return "DETAILS_CAPTURED";
  }

  if ((sample.media?.length ?? 0) > 0 || sample.samplingDate || sample.sampleStatus === "SAMPLING_IN_PROGRESS") {
    return "SAMPLING_IN_PROGRESS";
  }

  return "CREATED";
}

export function buildSampleCode(inspectionSerialNumber: string | null | undefined, lotNumber: string) {
  const serial = (inspectionSerialNumber ?? "SAMPLE").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-");
  const lot = lotNumber.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-");
  return `SMP-${serial}-${lot}`;
}
