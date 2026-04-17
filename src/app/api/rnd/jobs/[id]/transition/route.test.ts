import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeMock: vi.fn(),
  canMutateRndJobMock: vi.fn(),
  canTransitionMock: vi.fn(),
  getCurrentUserFromRequestMock: vi.fn(),
  recordAuditLogMock: vi.fn(),
  generateAndLinkRndReportSnapshotMock: vi.fn(),
  rndJobFindFirstMock: vi.fn(),
  packetUsageLedgerAggregateMock: vi.fn(),
  rndJobReadingCountMock: vi.fn(),
  transactionMock: vi.fn(),
  rndJobUpdateMock: vi.fn(),
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
    canTransition: mocks.canTransitionMock,
  };
});
vi.mock("@/lib/audit", () => ({
  recordAuditLog: mocks.recordAuditLogMock,
}));
vi.mock("@/lib/rnd-report-generation", () => ({
  generateAndLinkRndReportSnapshot: mocks.generateAndLinkRndReportSnapshotMock,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    rndJob: {
      findFirst: mocks.rndJobFindFirstMock,
      update: mocks.rndJobUpdateMock,
    },
    packetUsageLedger: {
      aggregate: mocks.packetUsageLedgerAggregateMock,
    },
    rndJobReading: {
      count: mocks.rndJobReadingCountMock,
    },
    $transaction: mocks.transactionMock,
  },
}));

import { POST } from "./route";

describe("/api/rnd/jobs/[id]/transition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUserFromRequestMock.mockResolvedValue({ id: "u1", companyId: "c1", role: "RND" });
    mocks.authorizeMock.mockReturnValue(undefined);
    mocks.canMutateRndJobMock.mockReturnValue(true);
    mocks.canTransitionMock.mockReturnValue(true);
    mocks.rndJobFindFirstMock.mockResolvedValue({
      id: "r1",
      parentJobId: "j1",
      packetId: "p1",
      previousRndJobId: "r-prev",
      packetUse: "TESTING",
      status: "READY_FOR_TESTING",
      assignedToId: "u1",
      approverUserId: "u2",
    });
    mocks.transactionMock.mockImplementation(async (callback: (tx: { rndJob: { update: typeof mocks.rndJobUpdateMock } }) => Promise<unknown>) => {
      return callback({ rndJob: { update: mocks.rndJobUpdateMock } });
    });
    mocks.rndJobUpdateMock.mockResolvedValue({ id: "r1", status: "IN_TESTING" });
    mocks.recordAuditLogMock.mockResolvedValue(undefined);
    mocks.generateAndLinkRndReportSnapshotMock.mockResolvedValue({ id: "snap-1" });
  });

  it("blocks testing transition when no allocation exists", async () => {
    mocks.packetUsageLedgerAggregateMock.mockResolvedValueOnce({ _sum: { quantity: 0 } });
    mocks.packetUsageLedgerAggregateMock.mockResolvedValueOnce({ _sum: { quantity: 0 } });

    const response = await POST(
      {
        json: async () => ({ toStatus: "IN_TESTING" }),
      } as NextRequest,
      { params: Promise.resolve({ id: "r1" }) },
    );

    expect(response.status).toBe(422);
    const payload = (await response.json()) as { details: string };
    expect(payload.details).toContain("Allocate packet quantity");
  });

  it("allows review transition when allocation, consume, and readings exist", async () => {
    mocks.rndJobFindFirstMock.mockResolvedValueOnce({
      id: "r1",
      parentJobId: "j1",
      packetId: "p1",
      previousRndJobId: "r-prev",
      packetUse: "TESTING",
      status: "IN_TESTING",
      assignedToId: "u1",
      approverUserId: "u2",
    });
    mocks.packetUsageLedgerAggregateMock
      .mockResolvedValueOnce({ _sum: { quantity: 5 } })
      .mockResolvedValueOnce({ _sum: { quantity: 0 } })
      .mockResolvedValueOnce({ _sum: { quantity: 4 } });
    mocks.rndJobReadingCountMock.mockResolvedValueOnce(2);
    mocks.rndJobUpdateMock.mockResolvedValueOnce({ id: "r1", status: "AWAITING_REVIEW" });

    const response = await POST(
      {
        json: async () => ({ toStatus: "AWAITING_REVIEW" }),
      } as NextRequest,
      { params: Promise.resolve({ id: "r1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.rndJobUpdateMock).toHaveBeenCalled();
  });

  it("links a report snapshot when completing the R&D job", async () => {
    mocks.rndJobFindFirstMock.mockResolvedValueOnce({
      id: "r1",
      parentJobId: "j1",
      packetId: "p1",
      previousRndJobId: "r-prev",
      packetUse: "TESTING",
      status: "APPROVED",
      assignedToId: "u1",
      approverUserId: "u2",
    });
    mocks.rndJobUpdateMock.mockResolvedValueOnce({ id: "r1", status: "COMPLETED" });

    const response = await POST(
      {
        json: async () => ({ toStatus: "COMPLETED" }),
      } as NextRequest,
      { params: Promise.resolve({ id: "r1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.generateAndLinkRndReportSnapshotMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        companyId: "c1",
        rndJobId: "r1",
      }),
    );
  });
});
