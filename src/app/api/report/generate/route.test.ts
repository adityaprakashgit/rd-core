import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeMock: vi.fn(),
  getCurrentUserFromRequestMock: vi.fn(),
  inspectionJobFindUniqueMock: vi.fn(),
  rndJobFindUniqueMock: vi.fn(),
  reportSnapshotCreateMock: vi.fn(),
  rndReportVersionUpdateManyMock: vi.fn(),
  rndReportVersionCreateMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock("@/lib/rbac", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rbac")>("@/lib/rbac");
  return { ...actual, authorize: mocks.authorizeMock };
});
vi.mock("@/lib/session", () => ({
  getCurrentUserFromRequest: mocks.getCurrentUserFromRequestMock,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    inspectionJob: {
      findUnique: mocks.inspectionJobFindUniqueMock,
    },
    rndJob: {
      findUnique: mocks.rndJobFindUniqueMock,
    },
    reportSnapshot: {
      create: mocks.reportSnapshotCreateMock,
    },
    rndReportVersion: {
      updateMany: mocks.rndReportVersionUpdateManyMock,
      create: mocks.rndReportVersionCreateMock,
    },
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
    mocks.inspectionJobFindUniqueMock
      .mockResolvedValueOnce({ companyId: "c1" })
      .mockResolvedValueOnce({
        id: "j1",
        companyId: "c1",
        jobReferenceNumber: "JOB-1",
        inspectionSerialNumber: "JOB-1",
        clientName: "Client",
        commodity: "Material",
        plantLocation: "Plant",
        status: "REPORT",
        createdAt: new Date("2026-04-10T00:00:00.000Z"),
        updatedAt: new Date("2026-04-10T00:00:00.000Z"),
        lots: [],
        experiments: [],
      });
    mocks.reportSnapshotCreateMock.mockResolvedValue({
      id: "snap-1",
      jobId: "j1",
      createdAt: new Date("2026-04-10T10:00:00.000Z"),
    });
    mocks.rndReportVersionUpdateManyMock.mockResolvedValue({ count: 1 });
    mocks.rndReportVersionCreateMock.mockResolvedValue({ id: "rv-1" });
    mocks.transactionMock.mockImplementation(async (callback: (tx: {
      reportSnapshot: { create: typeof mocks.reportSnapshotCreateMock };
      rndReportVersion: {
        updateMany: typeof mocks.rndReportVersionUpdateManyMock;
        create: typeof mocks.rndReportVersionCreateMock;
      };
    }) => Promise<unknown>) =>
      callback({
        reportSnapshot: { create: mocks.reportSnapshotCreateMock },
        rndReportVersion: {
          updateMany: mocks.rndReportVersionUpdateManyMock,
          create: mocks.rndReportVersionCreateMock,
        },
      }));
  });

  it("creates and links an active report version when rndJobId is provided", async () => {
    mocks.rndJobFindUniqueMock.mockResolvedValue({
      id: "r1",
      companyId: "c1",
      parentJobId: "j1",
      sampleId: "s1",
      status: "APPROVED",
    });

    const response = await POST({
      json: async () => ({ rndJobId: "r1" }),
    } as NextRequest);

    expect(response.status).toBe(200);
    expect(mocks.rndReportVersionUpdateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: "c1",
          parentJobId: "j1",
          sampleId: "s1",
          precedence: "ACTIVE",
        }),
      }),
    );
    expect(mocks.rndReportVersionCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: "c1",
          parentJobId: "j1",
          sampleId: "s1",
          rndJobId: "r1",
          reportSnapshotId: "snap-1",
          precedence: "ACTIVE",
        }),
      }),
    );
  });

  it("keeps legacy generate path compatible when only jobId is provided", async () => {
    const response = await POST({
      json: async () => ({ jobId: "j1" }),
    } as NextRequest);

    expect(response.status).toBe(200);
    expect(mocks.rndReportVersionUpdateManyMock).not.toHaveBeenCalled();
    expect(mocks.rndReportVersionCreateMock).not.toHaveBeenCalled();
  });
});
