import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeMock: vi.fn(),
  getCurrentUserFromRequestMock: vi.fn(),
  generateAndLinkRndReportSnapshotMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock("@/lib/rbac", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rbac")>("@/lib/rbac");
  return { ...actual, authorize: mocks.authorizeMock };
});
vi.mock("@/lib/session", () => ({
  getCurrentUserFromRequest: mocks.getCurrentUserFromRequestMock,
}));
vi.mock("@/lib/rnd-report-generation", () => ({
  generateAndLinkRndReportSnapshot: mocks.generateAndLinkRndReportSnapshotMock,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transactionMock,
  },
}));

import { POST } from "./route";

describe("/api/report/generate POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUserFromRequestMock.mockResolvedValue({
      id: "u1",
      companyId: "c1",
      role: "ADMIN",
    });
    mocks.authorizeMock.mockReturnValue(undefined);
    mocks.generateAndLinkRndReportSnapshotMock.mockResolvedValue({
      id: "snap-1",
      jobId: "j1",
      createdAt: new Date("2026-04-10T10:00:00.000Z"),
    });
    mocks.transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({}),
    );
  });

  it("creates and links an active report version when rndJobId is provided", async () => {
    const response = await POST({
      json: async () => ({ rndJobId: "r1" }),
    } as NextRequest);

    expect(response.status).toBe(200);
    expect(mocks.generateAndLinkRndReportSnapshotMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        companyId: "c1",
        jobId: "",
        rndJobId: "r1",
      }),
    );
  });

  it("keeps legacy generate path compatible when only jobId is provided", async () => {
    const response = await POST({
      json: async () => ({ jobId: "j1" }),
    } as NextRequest);

    expect(response.status).toBe(200);
    expect(mocks.generateAndLinkRndReportSnapshotMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        companyId: "c1",
        jobId: "j1",
        rndJobId: "",
      }),
    );
  });
});
