import { describe, expect, it } from "vitest";

import type { SampleRecord } from "@/types/inspection";

import {
  getInspectionSamplingDisplayStatus,
  getSampleReadiness,
  getSamplingReadinessInvariantError,
  isInspectionReadyForSampling,
} from "./sample-management";

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
  it("accepts homogenized proof as the sample proof photo", () => {
    const readiness = getSampleReadiness(
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

    expect(readiness.isReady).toBe(true);
    expect(readiness.blockers).toHaveLength(0);
  });

  it("names a missing seal number as bag evidence", () => {
    const missingSealNumber = getSampleReadiness(
      buildSample({
        sealLabel: {
          id: "seal-1",
          sampleId: "sample-1",
          sealNo: "",
          sealedAt: new Date(),
          createdAt: new Date(),
        },
      }),
    );

    expect(missingSealNumber.isReady).toBe(false);
    expect(missingSealNumber.blockers).toHaveLength(1);
    expect(missingSealNumber.blockers[0]).toMatchObject({
      groupTitle: "Bag evidence",
      proofLabel: "Seal number",
      locationLabel: "Seal Evidence > Seal number",
    });
    expect(missingSealNumber.missing[0]).toContain("Bag evidence: Seal number is missing.");
  });

  it("treats the lot seal number as a valid seal-number fallback", () => {
    const readiness = getSampleReadiness(
      buildSample({
        sealLabel: {
          id: "seal-1",
          sampleId: "sample-1",
          sealNo: "",
          sealedAt: new Date(),
          createdAt: new Date(),
        },
      }),
      { lotSealNumber: "1234567890123456" },
    );

    expect(readiness.isReady).toBe(true);
    expect(readiness.blockers).toHaveLength(0);
  });

  it("treats all lot seal numbers as a valid seal fallback for job-level homogeneous samples", () => {
    const readiness = getSampleReadiness(buildSample({ sealLabel: null }), {
      lotSealNumbers: ["1111222233334444", "5555666677778888"],
    });

    expect(readiness.isReady).toBe(true);
    expect(readiness.blockers).toHaveLength(0);
  });

  it("treats READY_FOR_SAMPLING as invalid until inspection is completed", () => {
    expect(
      isInspectionReadyForSampling({
        inspectionStatus: "IN_PROGRESS",
        decisionStatus: "READY_FOR_SAMPLING",
      }),
    ).toBe(false);

    expect(
      getSamplingReadinessInvariantError({
        inspectionStatus: "IN_PROGRESS",
        decisionStatus: "READY_FOR_SAMPLING",
      }),
    ).toBe("READY_FOR_SAMPLING_REQUIRES_COMPLETED_INSPECTION");

    expect(
      isInspectionReadyForSampling({
        inspectionStatus: "COMPLETED",
        decisionStatus: "READY_FOR_SAMPLING",
      }),
    ).toBe(true);
  });

  it("does not display READY_FOR_SAMPLING when the inspection remains blocked", () => {
    expect(
      getInspectionSamplingDisplayStatus({
        inspectionStatus: "COMPLETED",
        decisionStatus: "READY_FOR_SAMPLING",
        samplingBlockedFlag: true,
      }),
    ).toBe("BLOCKED");

    expect(
      getInspectionSamplingDisplayStatus({
        inspectionStatus: "COMPLETED",
        decisionStatus: "READY_FOR_SAMPLING",
        samplingBlockedFlag: false,
      }),
    ).toBe("READY_FOR_SAMPLING");
  });
});
