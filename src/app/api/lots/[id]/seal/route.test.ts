import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUserFromRequestMock: vi.fn(),
  authorizeMock: vi.fn(),
  assertCompanyScopeMock: vi.fn(),
  generateUniqueSealNumberMock: vi.fn(),
  isValidSealNumberMock: vi.fn(),
  recomputeJobWorkflowMilestonesMock: vi.fn(),
  inspectionLotFindUniqueMock: vi.fn(),
  inspectionLotFindFirstMock: vi.fn(),
  transactionMock: vi.fn(),
  inspectionLotUpdateMock: vi.fn(),
  sampleFindUniqueMock: vi.fn(),
  sampleSealLabelUpsertMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getCurrentUserFromRequest: mocks.getCurrentUserFromRequestMock,
}));

vi.mock("@/lib/rbac", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rbac")>("@/lib/rbac");
  return {
    ...actual,
    authorize: mocks.authorizeMock,
    assertCompanyScope: mocks.assertCompanyScopeMock,
  };
});

vi.mock("@/lib/traceability", () => ({
  generateUniqueSealNumber: mocks.generateUniqueSealNumberMock,
  isValidSealNumber: mocks.isValidSealNumberMock,
}));

vi.mock("@/lib/workflow-milestones", () => ({
  recomputeJobWorkflowMilestones: mocks.recomputeJobWorkflowMilestonesMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    inspectionLot: {
      findUnique: mocks.inspectionLotFindUniqueMock,
      findFirst: mocks.inspectionLotFindFirstMock,
    },
    $transaction: mocks.transactionMock,
  },
}));

import { POST } from "./route";

describe("/api/lots/[id]/seal sample sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SEAL_ASSIGNMENT_POLICY = "OPEN";

    mocks.getCurrentUserFromRequestMock.mockResolvedValue({
      id: "ops-1",
      companyId: "company-1",
      role: "OPERATIONS",
    });
    mocks.authorizeMock.mockReturnValue(undefined);
    mocks.assertCompanyScopeMock.mockReturnValue(undefined);
    mocks.generateUniqueSealNumberMock.mockResolvedValue("1234567890123456");
    mocks.isValidSealNumberMock.mockReturnValue(true);
    mocks.recomputeJobWorkflowMilestonesMock.mockResolvedValue(undefined);
    mocks.inspectionLotFindUniqueMock.mockResolvedValue({
      id: "lot-1",
      jobId: "job-1",
      companyId: "company-1",
      lotNumber: "LOT-1",
      sealNumber: null,
      bagPhotoUrl: null,
      samplingPhotoUrl: null,
      sealPhotoUrl: null,
      mediaFiles: [],
      job: { status: "IN_PROGRESS" },
      inspection: { inspectionStatus: "IN_PROGRESS", decisionStatus: "PENDING", mediaFiles: [] },
    });
    mocks.inspectionLotFindFirstMock.mockResolvedValue(null);
    mocks.inspectionLotUpdateMock.mockResolvedValue({
      id: "lot-1",
      lotNumber: "LOT-1",
      sealNumber: "1234567890123456",
      sealAuto: true,
      companyId: "company-1",
    });
    mocks.sampleFindUniqueMock.mockResolvedValue({
      id: "sample-1",
      sealLabel: { sealedAt: null },
    });
    mocks.sampleSealLabelUpsertMock.mockResolvedValue(undefined);
    mocks.auditLogCreateMock.mockResolvedValue(undefined);

    mocks.transactionMock.mockImplementation(async (callback: (tx: Record<string, unknown>) => Promise<unknown>) =>
      callback({
        inspectionLot: { update: mocks.inspectionLotUpdateMock },
        sample: { findUnique: mocks.sampleFindUniqueMock },
        sampleSealLabel: { upsert: mocks.sampleSealLabelUpsertMock },
        auditLog: { create: mocks.auditLogCreateMock },
      }),
    );
  });

  afterEach(() => {
    delete process.env.SEAL_ASSIGNMENT_POLICY;
  });

  it("syncs generated lot seal into sample seal label when sample exists", async () => {
    const response = await POST(
      {
        json: async () => ({ auto: true }),
      } as NextRequest,
      { params: Promise.resolve({ id: "lot-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.sampleSealLabelUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sampleId: "sample-1" },
        update: expect.objectContaining({
          sealNo: "1234567890123456",
          sealStatus: "COMPLETED",
        }),
        create: expect.objectContaining({
          sampleId: "sample-1",
          sealNo: "1234567890123456",
          sealStatus: "COMPLETED",
        }),
      }),
    );
  });
});
