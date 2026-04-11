import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeMock: vi.fn(),
  getCurrentUserFromRequestMock: vi.fn(),
  recordAuditLogMock: vi.fn(),
  transactionMock: vi.fn(),
  rndJobFindManyMock: vi.fn(),
  rndJobFindFirstMock: vi.fn(),
  packetFindFirstMock: vi.fn(),
  rndJobCreateMock: vi.fn(),
  packetUsageLedgerCreateMock: vi.fn(),
}));

vi.mock("@/lib/rbac", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rbac")>("@/lib/rbac");
  return { ...actual, authorize: mocks.authorizeMock };
});
vi.mock("@/lib/session", () => ({
  getCurrentUserFromRequest: mocks.getCurrentUserFromRequestMock,
}));
vi.mock("@/lib/audit", () => ({
  recordAuditLog: mocks.recordAuditLogMock,
}));
vi.mock("@/lib/rnd-workflow", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rnd-workflow")>("@/lib/rnd-workflow");
  return {
    ...actual,
    generateRndJobNumber: vi.fn().mockResolvedValue("RND-2026-0002"),
  };
});
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transactionMock,
    rndJob: {
      findMany: mocks.rndJobFindManyMock,
    },
  },
}));

import { GET, POST } from "./route";

describe("/api/rnd/jobs POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUserFromRequestMock.mockResolvedValue({ id: "u1", companyId: "c1", role: "RND" });
    mocks.authorizeMock.mockReturnValue(undefined);
    mocks.recordAuditLogMock.mockResolvedValue(undefined);
    mocks.rndJobFindManyMock.mockResolvedValue([]);

    mocks.transactionMock.mockImplementation(async (callback: (tx: {
      rndJob: { findFirst: typeof mocks.rndJobFindFirstMock; create: typeof mocks.rndJobCreateMock };
      packet: { findFirst: typeof mocks.packetFindFirstMock };
      packetUsageLedger: { create: typeof mocks.packetUsageLedgerCreateMock };
    }) => Promise<unknown>) => {
      return callback({
        rndJob: { findFirst: mocks.rndJobFindFirstMock, create: mocks.rndJobCreateMock },
        packet: { findFirst: mocks.packetFindFirstMock },
        packetUsageLedger: { create: mocks.packetUsageLedgerCreateMock },
      });
    });

    mocks.rndJobFindFirstMock.mockResolvedValue({
      id: "source-rnd",
      parentJobId: "job-1",
      lotId: "lot-1",
      sampleId: "sample-1",
      packetId: "packet-1",
      status: "COMPLETED",
      priority: "MEDIUM",
      deadline: null,
      assignedToId: "u1",
      approverUserId: "u2",
    });
    mocks.packetFindFirstMock.mockResolvedValue({
      id: "packet-1",
      jobId: "job-1",
      lotId: "lot-1",
      sampleId: "sample-1",
      packetUnit: "KG",
      packetStatus: "AVAILABLE",
      packetWeight: 100,
      packetQuantity: null,
      usageLedgerEntries: [],
    });
    mocks.rndJobCreateMock.mockResolvedValue({
      id: "new-rnd",
      rndJobNumber: "RND-2026-0002",
    });
    mocks.packetUsageLedgerCreateMock.mockResolvedValue({
      id: "ledger-1",
    });
  });

  it("requires explicit retest payload fields", async () => {
    const response = await POST(
      { json: async () => ({ sourceRndJobId: "source-rnd" }) } as NextRequest,
    );
    expect(response.status).toBe(400);
  });

  it("creates retest and initial ALLOCATE ledger entry", async () => {
    const response = await POST(
      {
        json: async () => ({
          sourceRndJobId: "source-rnd",
          packetId: "packet-1",
          requestedQty: 20,
          useType: "TESTING",
          reason: "Client requested retest",
        }),
      } as NextRequest,
    );

    expect(response.status).toBe(201);
    expect(mocks.rndJobCreateMock).toHaveBeenCalled();
    expect(mocks.packetUsageLedgerCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entryType: "ALLOCATE",
          quantity: 20,
          packetId: "packet-1",
        }),
      }),
    );
  });

  it("returns queue rows with mapped bucket and primary action", async () => {
    mocks.rndJobFindManyMock.mockResolvedValueOnce([
      {
        id: "r1",
        rndJobNumber: "RND-2026-0001",
        status: "CREATED",
        packetUse: "TESTING",
        priority: "MEDIUM",
        deadline: null,
        receivedAt: new Date("2026-04-10T00:00:00.000Z"),
        parentJob: { inspectionSerialNumber: "JOB-0001" },
        lot: { lotNumber: "LOT-1" },
        sample: { sampleCode: "SAMPLE-1" },
        packet: { packetCode: "PACK-1", packetWeight: 10, packetUnit: "KG" },
        assignedTo: null,
      },
    ]);

    const response = await GET({ nextUrl: { searchParams: new URLSearchParams() } } as unknown as NextRequest);
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      rows: Array<{ bucket: string; primaryAction: string; parentJob: { inspectionSerialNumber: string } }>;
    };

    expect(payload.rows[0]?.bucket).toBe("PENDING_INTAKE");
    expect(payload.rows[0]?.primaryAction).toBe("Accept Job");
    expect(payload.rows[0]?.parentJob.inspectionSerialNumber).toBe("JOB-0001");
  });
});
