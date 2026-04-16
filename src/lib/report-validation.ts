import { deriveSampleStatus } from "@/lib/sample-management";
import type { SampleRecord } from "@/types/inspection";

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

type ReportValidationJob = {
  jobReferenceNumber: string | null;
  clientName: string;
  commodity: string;
  lots: Array<{
    lotNumber: string;
    quantityMode?: string | null;
    totalBags?: number | null;
    grossWeight?: number | null;
    netWeight?: number | null;
    grossWeightKg?: unknown;
    netWeightKg?: unknown;
    bags: Array<{
      netWeight: number | null;
    }>;
    sample?: ReportValidationSample | null;
  }>;
  samples?: ReportValidationSample[];
  experiments: Array<{
    trials: Array<{
      trialNumber: number;
      measurements: Array<{
        element: string;
        value: unknown;
      }>;
    }>;
  }>;
  rndJobs?: Array<{
    rndJobNumber: string;
    status: string;
    resultPrecedence?: string | null;
    readings: Array<{
      parameter: string;
      value: unknown;
    }>;
  }>;
};

type ReportValidationSample = {
  id: string;
  lotId?: string | null;
  sampleStatus: string;
  sampleType?: string | null;
  samplingMethod?: string | null;
  samplingDate?: string | Date | null;
  sampleQuantity?: number | null;
  sampleUnit?: string | null;
  containerType?: string | null;
  homogeneousProofDone?: boolean | null;
  homogenizedAt?: string | Date | null;
  readyForPacketingAt?: string | Date | null;
  media?: Array<{
    id: string;
    mediaType: string;
    fileUrl: string;
    capturedAt: string | Date;
  }>;
  sealLabel?: {
    sealNo?: string | null;
    labelText?: string | null;
    sealedAt?: string | Date | null;
    labeledAt?: string | Date | null;
  } | null;
  events?: Array<{
    id: string;
    eventType: string;
    eventTime: string | Date;
  }>;
  packets?: Array<{
    id: string;
  }>;
};

export function buildReportValidation(job: ReportValidationJob) {
  let totalNetWeight = 0;
  let totalBagsFound = 0;

  job.lots.forEach((lot) => {
    if (lot.bags.length > 0) {
      lot.bags.forEach((bag) => {
        totalNetWeight += bag.netWeight || 0;
        totalBagsFound += 1;
      });
      return;
    }

    const lotNetWeight = toFiniteNumber(lot.netWeightKg) ?? toFiniteNumber(lot.netWeight);
    if (lotNetWeight !== null) {
      totalNetWeight += lotNetWeight;
      totalBagsFound += typeof lot.totalBags === "number" && lot.totalBags > 0 ? lot.totalBags : 1;
    }
  });

  const elementTotals: Record<string, { sum: number; count: number }> = {};
  const allTrials = job.experiments.flatMap((experiment) => experiment.trials);
  const activeRndJobs = (job.rndJobs ?? []).filter(
    (rndJob) =>
      rndJob.resultPrecedence === "ACTIVE" &&
      ["APPROVED", "COMPLETED"].includes(String(rndJob.status)),
  );
  const allRndReadings = activeRndJobs.flatMap((rndJob) => rndJob.readings);

  allTrials.forEach((trial) => {
    trial.measurements.forEach((measurement) => {
      const element = measurement.element.toUpperCase().trim();
      if (!element) {
        return;
      }

      if (!elementTotals[element]) {
        elementTotals[element] = { sum: 0, count: 0 };
      }

      elementTotals[element].sum += Number(measurement.value) || 0;
      elementTotals[element].count += 1;
    });
  });

  allRndReadings.forEach((reading) => {
    const element = reading.parameter.toUpperCase().trim();
    if (!element) {
      return;
    }

    if (!elementTotals[element]) {
      elementTotals[element] = { sum: 0, count: 0 };
    }

    elementTotals[element].sum += Number(reading.value) || 0;
    elementTotals[element].count += 1;
  });

  const averageComposition = Object.entries(elementTotals).map(([element, data]) => ({
    element,
    average: data.count > 0 ? data.sum / data.count : 0,
    count: data.count,
  }));

  const validationErrors: string[] = [];

  if (job.lots.length === 0) {
    validationErrors.push("Add at least one lot.");
  }

  job.lots.forEach((lot) => {
    const hasBagRows = lot.bags.length > 0;
    const hasLotWeights =
      toFiniteNumber(lot.grossWeightKg) !== null ||
      toFiniteNumber(lot.netWeightKg) !== null ||
      toFiniteNumber(lot.grossWeight) !== null ||
      toFiniteNumber(lot.netWeight) !== null;
    const requiresBagRows = (lot.quantityMode ?? "SINGLE_PIECE") === "MULTI_WEIGHT";

    if ((requiresBagRows && !hasBagRows) || (!requiresBagRows && !hasBagRows && !hasLotWeights)) {
      validationErrors.push(`Lot ${lot.lotNumber}: register bag rows and weights.`);
    }

  });

  const canonicalSample =
    (job.samples ?? []).find((sample) => !sample.lotId) ??
    (job.samples ?? [])[0] ??
    job.lots.map((lot) => lot.sample as SampleRecord | null | undefined).find(Boolean) ??
    null;

  if (!canonicalSample || deriveSampleStatus(canonicalSample as SampleRecord) !== "READY_FOR_PACKETING") {
    validationErrors.push("Finalize the job-level homogeneous sample.");
  }

  const packetCount = canonicalSample?.packets?.length ?? 0;
  if (packetCount === 0) {
    validationErrors.push("Generate at least one packet from the job-level homogeneous sample.");
  }

  if (allTrials.length === 0 && activeRndJobs.length === 0) {
    validationErrors.push("Create at least one R&D test attempt.");
  }

  allTrials.forEach((trial) => {
    if (trial.measurements.length === 0) {
      validationErrors.push(`Trial ${trial.trialNumber}: add at least one measurement.`);
    }
  });

  if (Object.keys(elementTotals).length === 0) {
    validationErrors.push("Record lab measurements for the job-level sample result.");
  }

  return {
    metrics: {
      totalNetWeight: Number(totalNetWeight.toFixed(2)),
      totalBags: totalBagsFound,
      averageComposition,
    },
    validation: {
      isValid: validationErrors.length === 0,
      errors: validationErrors,
    },
    summary: {
      client: job.clientName,
      commodity: job.commodity,
      reference: job.jobReferenceNumber,
    },
  };
}
