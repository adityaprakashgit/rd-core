import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeMock: vi.fn(),
  canMutateRndJobMock: vi.fn(),
  getCurrentUserFromRequestMock: vi.fn(),
  recordAuditLogMock: vi.fn(),
  rndJobFindFirstMock: vi.fn(),
  rndJobReviewCreateMock: vi.fn(),
  rndJobUpdateMock: vi.fn(),
  rndJobUpdateManyMock: vi.fn(),
  rndReportVersionUpdateManyMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock("@/lib/rbac", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rbac")>("@/lib/rbac");
  return { ...actual, authorize: mocks.authorizeMock };
});
vi.mock("@/lib/session", () => ({
  getCurrentUserFromRequest: mocks.getCurrentUserFromRequestMock,
}));
vi.mock("@/lib/rnd-workflow", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rnd-workflow")>("@/lib/rnd-workflow");
  return {
    ...actual,
    canMutateRndJob: mocks.canMutateRndJobMock,
  };
});
vi.mock("@/lib/audit", () => ({
  recordAuditLog: mocks.recordAuditLogMock,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    rndJob: {
      findFirst: mocks.rndJobFindFirstMock,
      update: mocks.rndJobUpdateMock,
      updateMany: mocks.rndJobUpdateManyMock,
    },
    rndJobReview: {
      create: mocks.rndJobReviewCreateMock,
    },
    rndReportVersion: {
      updateMany: mocks.rndReportVersionUpdateManyMock,
    },
    $transaction: mocks.transactionMock,
  },
}));

import { POST } from "./route";

describe("/api/rnd/jobs/[id]/review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUserFromRequestMock.mockResolvedValue({ id: "u-approver", companyId: "c1", role: "RND" });
    mocks.authorizeMock.mockReturnValue(undefined);
    mocks.canMutateRndJobMock.mockReturnValue(true);
    mocks.rndJobFindFirstMock.mockResolvedValue({
      id: "r1",
      parentJobId: "j1",
      sampleId: "s1",
      status: "AWAITING_REVIEW",
      assignedToId: "u-assignee",
      approverUserId: "u-approver",
    });
    mocks.rndJobReviewCreateMock.mockResolvedValue({ id: "rev-1" });
    mocks.rndJobUpdateMock.mockResolvedValue({ id: "r1", status: "APPROVED" });
    mocks.rndJobUpdateManyMock.mockResolvedValue({ count: 1 });
    mocks.rndReportVersionUpdateManyMock.mockResolvedValue({ count: 1 });
    mocks.recordAuditLogMock.mockResolvedValue(undefined);
    mocks.transactionMock.mockImplementation(async (callback: (tx: {
      rndJobReview: { create: typeof mocks.rndJobReviewCreateMock };
      rndJob: { update: typeof mocks.rndJobUpdateMock; updateMany: typeof mocks.rndJobUpdateManyMock };
      rndReportVersion: { updateMany: typeof mocks.rndReportVersionUpdateManyMock };
    }) => Promise<unknown>) =>
      callback({
        rndJobReview: { create: mocks.rndJobReviewCreateMock },
        rndJob: { update: mocks.rndJobUpdateMock, updateMany: mocks.rndJobUpdateManyMock },
        rndReportVersion: { updateMany: mocks.rndReportVersionUpdateManyMock },
      }));
  });

  it("marks prior approved results as superseded when approving new retest result", async () => {
    const response = await POST(
      { json: async () => ({ action: "APPROVE", notes: "" }) } as NextRequest,
      { params: Promise.resolve({ id: "r1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.rndJobUpdateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          parentJobId: "j1",
          sampleId: "s1",
        }),
        data: { resultPrecedence: "SUPERSEDED" },
      }),
    );
    expect(mocks.rndReportVersionUpdateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          parentJobId: "j1",
          sampleId: "s1",
          precedence: "ACTIVE",
        }),
        data: { precedence: "SUPERSEDED" },
      }),
    );
  });
});
