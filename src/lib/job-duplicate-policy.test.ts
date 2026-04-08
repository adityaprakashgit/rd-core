import { describe, expect, it } from "vitest";

import { evaluateDuplicateOverrideDecision, type DuplicateJobCandidate } from "./job-duplicate-policy";

const candidate: DuplicateJobCandidate = {
  id: "job-1",
  inspectionSerialNumber: "INS-001",
  jobReferenceNumber: "REF-001",
  clientName: "Client A",
  commodity: "Wheat",
  plantLocation: "Plant A",
  status: "IN_PROGRESS",
  createdAt: new Date("2026-04-08T09:00:00.000Z"),
};

describe("duplicate override decision", () => {
  it("blocks when duplicates exist and override is not requested", () => {
    const decision = evaluateDuplicateOverrideDecision({
      duplicates: [candidate],
      duplicateWindowHours: 24,
      overrideDuplicate: false,
      overrideReason: null,
      userRole: "OPERATIONS",
    });

    expect(decision.kind).toBe("BLOCK_DUPLICATE");
  });

  it("returns validation error when override reason is missing", () => {
    const decision = evaluateDuplicateOverrideDecision({
      duplicates: [candidate],
      duplicateWindowHours: 24,
      overrideDuplicate: true,
      overrideReason: " ",
      userRole: "ADMIN",
    });

    expect(decision.kind).toBe("VALIDATION_ERROR");
  });

  it("forbids non-admin override", () => {
    const decision = evaluateDuplicateOverrideDecision({
      duplicates: [candidate],
      duplicateWindowHours: 24,
      overrideDuplicate: true,
      overrideReason: "Business exception",
      userRole: "OPERATIONS",
    });

    expect(decision.kind).toBe("FORBIDDEN_OVERRIDE");
  });

  it("allows admin override with audit metadata", () => {
    const decision = evaluateDuplicateOverrideDecision({
      duplicates: [candidate],
      duplicateWindowHours: 24,
      overrideDuplicate: true,
      overrideReason: "Planned split shipment",
      userRole: "ADMIN",
    });

    expect(decision.kind).toBe("ALLOW_OVERRIDE");
    if (decision.kind === "ALLOW_OVERRIDE") {
      expect(decision.auditMetadata.duplicateOverride).toBe(true);
      expect(decision.auditMetadata.duplicateOverrideReason).toBe("Planned split shipment");
      expect(decision.auditMetadata.duplicateCandidateIds).toEqual(["job-1"]);
    }
  });

  it("proceeds when duplicates are absent", () => {
    const decision = evaluateDuplicateOverrideDecision({
      duplicates: [],
      duplicateWindowHours: 24,
      overrideDuplicate: false,
      overrideReason: null,
      userRole: "OPERATIONS",
    });

    expect(decision.kind).toBe("PROCEED");
    if (decision.kind === "PROCEED") {
      expect(decision.auditMetadata.duplicateCandidateCount).toBe(0);
    }
  });
});
