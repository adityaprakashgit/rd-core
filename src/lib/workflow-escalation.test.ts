import {
  WorkflowEscalationSeverity,
  WorkflowEscalationStatus,
  WorkflowEscalationType,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  buildDuplicateJobEscalation,
  buildLotConflictEscalation,
  buildWorkflowEscalationCreateData,
} from "./workflow-escalation";

describe("workflow escalation mapping", () => {
  it("applies default status and severity", () => {
    const data = buildWorkflowEscalationCreateData({
      companyId: "company-1",
      type: WorkflowEscalationType.OPERATIONAL_BLOCK,
      title: "Operational block",
    });

    expect(data.severity).toBe(WorkflowEscalationSeverity.MEDIUM);
    expect(data.status).toBe(WorkflowEscalationStatus.OPEN);
  });

  it("maps duplicate-job escalation payload", () => {
    const data = buildDuplicateJobEscalation({
      companyId: "company-1",
      raisedByUserId: "user-1",
      sourceName: "Client A",
      materialCategory: "Wheat",
      sourceLocation: "Plant A",
      duplicateWindowHours: 24,
      overrideRequested: false,
      duplicateCandidates: [
        {
          id: "job-1",
          inspectionSerialNumber: "INS-001",
          jobReferenceNumber: "REF-001",
          status: "IN_PROGRESS",
          createdAt: new Date("2026-04-08T08:00:00.000Z"),
        },
      ],
    });

    expect(data.type).toBe(WorkflowEscalationType.DUPLICATE_JOB);
    expect(data.severity).toBe(WorkflowEscalationSeverity.MEDIUM);
    expect(data.detailsJson).toMatchObject({
      sourceName: "Client A",
      materialCategory: "Wheat",
      duplicateWindowHours: 24,
      overrideRequested: false,
    });
  });

  it("maps lot-conflict escalation payload", () => {
    const data = buildLotConflictEscalation({
      companyId: "company-1",
      raisedByUserId: "user-1",
      jobId: "job-7",
      lotId: "lot-3",
      expectedUpdatedAt: "2026-04-08T08:00:00.000Z",
      actualUpdatedAt: "2026-04-08T08:00:01.000Z",
    });

    expect(data.type).toBe(WorkflowEscalationType.LOT_CONFLICT);
    expect(data.severity).toBe(WorkflowEscalationSeverity.HIGH);
    expect(data.jobId).toBe("job-7");
    expect(data.lotId).toBe("lot-3");
    expect(data.detailsJson).toMatchObject({
      expectedUpdatedAt: "2026-04-08T08:00:00.000Z",
      actualUpdatedAt: "2026-04-08T08:00:01.000Z",
    });
  });
});
