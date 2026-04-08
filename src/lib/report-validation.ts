import { deriveSampleStatus } from "@/lib/sample-management";
import type { SampleRecord } from "@/types/inspection";

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
    bags: Array<{
      netWeight: number | null;
    }>;
    sample?: {
      id: string;
      sampleStatus: string;
      samplingDate?: string | Date | null;
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
    } | null;
  }>;
  experiments: Array<{
    trials: Array<{
      trialNumber: number;
      measurements: Array<{
        element: string;
        value: unknown;
      }>;
    }>;
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

    if (typeof lot.netWeight === "number") {
      totalNetWeight += lot.netWeight;
      totalBagsFound += typeof lot.totalBags === "number" && lot.totalBags > 0 ? lot.totalBags : 1;
    }
  });

  const elementTotals: Record<string, { sum: number; count: number }> = {};
  const allTrials = job.experiments.flatMap((experiment) => experiment.trials);

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
    const hasLotWeights = typeof lot.grossWeight === "number" || typeof lot.netWeight === "number";
    const requiresBagRows = (lot.quantityMode ?? "SINGLE_PIECE") === "MULTI_WEIGHT";

    if ((requiresBagRows && !hasBagRows) || (!requiresBagRows && !hasBagRows && !hasLotWeights)) {
      validationErrors.push(`Lot ${lot.lotNumber}: register bag rows and weights.`);
    }

    const sample = lot.sample as SampleRecord | null | undefined;
    if (sample) {
      if (deriveSampleStatus(sample) !== "READY_FOR_PACKETING") {
        validationErrors.push(`Lot ${lot.lotNumber}: finish sample preparation and mark it ready.`);
      }
    } else {
      validationErrors.push(`Lot ${lot.lotNumber}: create and complete managed sample preparation.`);
    }
  });

  const managedReadySamples = job.lots
    .map((lot) => lot.sample as SampleRecord | null | undefined)
    .filter((sample): sample is SampleRecord => Boolean(sample) && deriveSampleStatus(sample as SampleRecord) === "READY_FOR_PACKETING");

  const homogeneousSampleCount = managedReadySamples.length;

  if (homogeneousSampleCount === 0) {
    validationErrors.push("Finalize the homogeneous sample.");
  }

  const managedPacketCount = managedReadySamples.reduce((sum, sample) => sum + (sample.packets?.length ?? 0), 0);
  const packetCount = managedPacketCount;
  if (packetCount === 0) {
    validationErrors.push("Generate at least one packet.");
  }

  if (allTrials.length === 0) {
    validationErrors.push("Create at least one trial.");
  }

  allTrials.forEach((trial) => {
    if (trial.measurements.length === 0) {
      validationErrors.push(`Trial ${trial.trialNumber}: add at least one measurement.`);
    }
  });

  if (Object.keys(elementTotals).length === 0) {
    validationErrors.push("Record lab measurements for the sample result.");
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
