import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeMock: vi.fn(),
  getCurrentUserFromRequestMock: vi.fn(),
  rndJobFindFirstMock: vi.fn(),
  searchRndUsersMock: vi.fn(),
  resolveSuggestedRndAssigneeIdMock: vi.fn(),
  loadRndLineageLinkageMock: vi.fn(),
}));

vi.mock("@/lib/rbac", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rbac")>("@/lib/rbac");
  return { ...actual, authorize: mocks.authorizeMock };
});
vi.mock("@/lib/session", () => ({
  getCurrentUserFromRequest: mocks.getCurrentUserFromRequestMock,
}));
vi.mock("@/lib/rnd-user-picker", () => ({
  searchRndUsers: mocks.searchRndUsersMock,
  resolveSuggestedRndAssigneeId: mocks.resolveSuggestedRndAssigneeIdMock,
}));
vi.mock("@/lib/rnd-report-linkage", () => ({
  loadRndLineageLinkage: mocks.loadRndLineageLinkageMock,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    rndJob: {
      findFirst: mocks.rndJobFindFirstMock,
    },
  },
}));

import { GET } from "./route";

describe("/api/rnd/jobs/[id] GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUserFromRequestMock.mockResolvedValue({ id: "u1", companyId: "c1", role: "RND" });
    mocks.authorizeMock.mockReturnValue(undefined);
    mocks.searchRndUsersMock.mockResolvedValue([{ id: "u-rnd", displayName: "R&D User", role: "RND", email: "rnd@example.com" }]);
    mocks.resolveSuggestedRndAssigneeIdMock.mockResolvedValue("u-rnd");
    mocks.loadRndLineageLinkageMock.mockResolvedValue({
      activeResult: { id: "r1", rndJobNumber: "RND-2026-0001", status: "APPROVED", resultPrecedence: "ACTIVE" },
      supersededResults: [],
      activeReport: null,
      previousReports: [],
      defaultReportUrl: null,
      defaultCoaUrl: null,
    });
    mocks.rndJobFindFirstMock.mockResolvedValue({
      id: "r1",
      rndJobNumber: "RND-2026-0001",
      companyId: "c1",
      parentJobId: "j1",
      sampleId: "s1",
      status: "READY_FOR_TESTING",
      packetUse: null,
      testType: null,
      parentJob: { id: "j1", handedOverToRndTo: "u-rnd" },
      packet: { packetWeight: 100, packetQuantity: null },
      packetUsageLedgerEntries: [],
    });
  });

  it("returns blockers, picker options, and ledger summary", async () => {
    const response = await GET({} as NextRequest, { params: Promise.resolve({ id: "r1" }) });
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      blockers: string[];
      pickerOptions: { suggestedAssigneeId?: string | null };
      ledger: { balance: { available: number } };
    };
    expect(payload.blockers).toEqual(expect.arrayContaining(["packet use not selected", "test type not chosen"]));
    expect(payload.pickerOptions.suggestedAssigneeId).toBe("u-rnd");
    expect(payload.ledger.balance.available).toBe(100);
  });
});
