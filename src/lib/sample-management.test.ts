import { describe, expect, it } from "vitest";

import type { SampleRecord } from "@/types/inspection";

import { getSampleReadiness } from "./sample-management";

function buildSample(overrides?: Partial<SampleRecord>): SampleRecord {
  return {
    id: "sample-1",
    companyId: "company-1",
    jobId: "job-1",
    lotId: "lot-1",
    inspectionId: "insp-1",
    sampleCode: "SMP-1",
    sampleStatus: "SAMPLING_IN_PROGRESS",
    sampleType: "PRIMARY",
    samplingMethod: "MANUAL",
    sampleQuantity: 10,
    sampleUnit: "KG",
    containerType: "Bag",
    remarks: null,
    homogeneousProofDone: true,
    homogenizedAt: new Date(),
    createdById: "ops-1",
    createdAt: new Date(),
    media: [
      {
        id: "m1",
        sampleId: "sample-1",
        mediaType: "HOMOGENIZED_SAMPLE",
        fileUrl: "http://x/y.jpg",
        capturedAt: new Date(),
        createdAt: new Date(),
      },
    ],
    sealLabel: {
      id: "seal-1",
      sampleId: "sample-1",
      sealNo: "1234567890123456",
      sealedAt: new Date(),
      createdAt: new Date(),
    },
    ...overrides,
  };
}

describe("sample readiness seal requirements", () => {
  it("requires both seal number and sealed timestamp for readiness", () => {
    const missingSealedAt = getSampleReadiness(
      buildSample({
        sealLabel: {
          id: "seal-1",
          sampleId: "sample-1",
          sealNo: "1234567890123456",
          sealedAt: null,
          createdAt: new Date(),
        },
      }),
    );

    expect(missingSealedAt.isReady).toBe(false);
    expect(missingSealedAt.missing).toContain("Complete seal evidence");
  });
});
