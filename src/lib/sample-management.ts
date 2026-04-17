import type { SampleMediaRecord, SampleRecord } from "@/types/inspection";
import { REQUIRED_SAMPLE_MEDIA_TYPES, SAMPLE_EVIDENCE_ITEMS } from "@/lib/evidence-definition";

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

export function hasSealAndLabel(sample: SampleRecord | null | undefined) {
  const mediaMap = mapSampleMediaByType(sample?.media);
  const hasPhoto = Boolean(mediaMap["SEALED_SAMPLE"]?.fileUrl);
  return Boolean(
    sample?.sealLabel?.sealNo &&
      sample.sealLabel.sealedAt &&
      hasPhoto,
  );
}

export function getRequiredMissingMedia(sample: SampleRecord | null | undefined) {
  const mediaMap = mapSampleMediaByType(sample?.media);
  return readinessMediaRequirements.filter((type) => !mediaMap[type]?.fileUrl);
}

export function getSampleReadiness(sample: SampleRecord | null | undefined) {
  const missing: string[] = [];

  if (!sample) {
    missing.push("Start sampling");
    return { isReady: false, missing };
  }

  if (!hasSampleDetails(sample)) {
    missing.push("Capture sample details");
  }

  const missingMedia = getRequiredMissingMedia(sample);
  for (const mediaType of missingMedia) {
    // Already covered by hasSealAndLabel consolidated check
    if (mediaType === "SEALED_SAMPLE") continue;

    const definition = SAMPLE_EVIDENCE_ITEMS.find((item) => item.mediaType === mediaType);
    if (definition?.readinessHint) {
      missing.push(definition.readinessHint);
    }
  }

  if (!hasHomogenizedSample(sample)) {
    missing.push("Mark sample homogenized");
  }

  if (!hasSealAndLabel(sample)) {
    missing.push("Complete seal evidence");
  }

  return {
    isReady: missing.length === 0,
    missing,
  };
}

export function deriveSampleStatus(sample: SampleRecord | null | undefined): SampleStatus {
  if (!sample) {
    return "CREATED";
  }

  const readiness = getSampleReadiness(sample);
  if (readiness.isReady || sample.sampleStatus === "READY_FOR_PACKETING") {
    return "READY_FOR_PACKETING";
  }

  if (hasSealAndLabel(sample) || sample.sampleStatus === "SEALED") {
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
