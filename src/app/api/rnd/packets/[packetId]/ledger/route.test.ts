import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeMock: vi.fn(),
  getCurrentUserFromRequestMock: vi.fn(),
  recordAuditLogMock: vi.fn(),
  packetFindFirstMock: vi.fn(),
  packetUsageLedgerCreateMock: vi.fn(),
  rndJobFindFirstMock: vi.fn(),
  transactionMock: vi.fn(),
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
vi.mock("@/lib/prisma", () => ({
  prisma: {
    packet: {
      findFirst: mocks.packetFindFirstMock,
    },
    packetUsageLedger: {
      create: mocks.packetUsageLedgerCreateMock,
    },
    rndJob: {
      findFirst: mocks.rndJobFindFirstMock,
    },
    $transaction: mocks.transactionMock,
  },
}));

import { GET, POST } from "./route";

describe("/api/rnd/packets/[packetId]/ledger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUserFromRequestMock.mockResolvedValue({ id: "u1", companyId: "c1", role: "RND" });
    mocks.authorizeMock.mockReturnValue(undefined);
    mocks.recordAuditLogMock.mockResolvedValue(undefined);
    mocks.packetFindFirstMock.mockResolvedValue({
      id: "p1",
      jobId: "j1",
      packetCode: "PACK-1",
      packetWeight: 100,
      packetQuantity: null,
      packetUnit: "KG",
      packetStatus: "AVAILABLE",
      usageLedgerEntries: [],
    });
    mocks.rndJobFindFirstMock.mockResolvedValue({ id: "r1" });
    mocks.packetUsageLedgerCreateMock.mockResolvedValue({ id: "l1" });
    mocks.transactionMock.mockImplementation(async (callback: (tx: {
      packet: { findFirst: typeof mocks.packetFindFirstMock };
      rndJob: { findFirst: typeof mocks.rndJobFindFirstMock };
      packetUsageLedger: { create: typeof mocks.packetUsageLedgerCreateMock };
    }) => Promise<unknown>) =>
      callback({
        packet: { findFirst: mocks.packetFindFirstMock },
        rndJob: { findFirst: mocks.rndJobFindFirstMock },
        packetUsageLedger: { create: mocks.packetUsageLedgerCreateMock },
      }));
  });

  it("returns packet ledger balances", async () => {
    const response = await GET({} as NextRequest, { params: Promise.resolve({ packetId: "p1" }) });
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { balance: { available: number } };
    expect(payload.balance.available).toBe(100);
  });

  it("blocks consume when reserved quantity is insufficient", async () => {
    const response = await POST(
      {
        json: async () => ({
          entryType: "CONSUME",
          useType: "TESTING",
          quantity: 10,
          unit: "KG",
          rndJobId: "r1",
        }),
      } as NextRequest,
      { params: Promise.resolve({ packetId: "p1" }) },
    );
    expect(response.status).toBe(422);
  });
});
