import { describe, expect, it, vi } from "vitest";

import { generateAndLinkRndReportSnapshot } from "@/lib/rnd-report-generation";

describe("generateAndLinkRndReportSnapshot", () => {
  it("creates and links an active report version for an R&D lineage", async () => {
    const rndJobFindUnique = vi.fn().mockResolvedValue({
      id: "r1",
      companyId: "c1",
      parentJobId: "j1",
      sampleId: "s1",
      status: "APPROVED",
    });
    const inspectionJobFindUnique = vi.fn().mockResolvedValue({
      id: "j1",
      companyId: "c1",
      jobReferenceNumber: "JOB-1",
      inspectionSerialNumber: "INS-1",
      clientName: "Client",
      commodity: "Commodity",
      plantLocation: "Plant",
      status: "COMPLETE",
      createdAt: new Date("2026-04-10T00:00:00.000Z"),
      updatedAt: new Date("2026-04-10T00:00:00.000Z"),
      lots: [],
      samples: [],
      rndJobs: [],
      experiments: [],
    });
    const reportSnapshotCreate = vi.fn().mockResolvedValue({ id: "snap-1" });
    const rndReportVersionUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const rndReportVersionCreate = vi.fn().mockResolvedValue({ id: "rv-1" });

    const db = {
      rndJob: { findUnique: rndJobFindUnique },
      inspectionJob: { findUnique: inspectionJobFindUnique },
      reportSnapshot: { create: reportSnapshotCreate },
      rndReportVersion: {
        updateMany: rndReportVersionUpdateMany,
        create: rndReportVersionCreate,
      },
    } as never;

    const snapshot = await generateAndLinkRndReportSnapshot(db, {
      companyId: "c1",
      rndJobId: "r1",
    });

    expect(snapshot).toEqual({ id: "snap-1" });
    expect(rndJobFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "r1" },
      }),
    );
    expect(inspectionJobFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "j1" },
      }),
    );
    expect(reportSnapshotCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          jobId: "j1",
        }),
      }),
    );
    expect(rndReportVersionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: "c1",
          parentJobId: "j1",
          sampleId: "s1",
          precedence: "ACTIVE",
        }),
      }),
    );
    expect(rndReportVersionCreate).toHaveBeenCalledWith(
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

  it("supports legacy job-only snapshot generation without lineage updates", async () => {
    const inspectionJobFindUnique = vi.fn().mockResolvedValue({
      id: "j1",
      companyId: "c1",
      jobReferenceNumber: "JOB-1",
      inspectionSerialNumber: "INS-1",
      clientName: "Client",
      commodity: "Commodity",
      plantLocation: "Plant",
      status: "COMPLETE",
      createdAt: new Date("2026-04-10T00:00:00.000Z"),
      updatedAt: new Date("2026-04-10T00:00:00.000Z"),
      lots: [],
      samples: [],
      rndJobs: [],
      experiments: [],
    });
    const reportSnapshotCreate = vi.fn().mockResolvedValue({ id: "snap-2" });
    const rndReportVersionUpdateMany = vi.fn();
    const rndReportVersionCreate = vi.fn();

    const db = {
      rndJob: {
        findUnique: vi.fn(),
      },
      inspectionJob: { findUnique: inspectionJobFindUnique },
      reportSnapshot: { create: reportSnapshotCreate },
      rndReportVersion: {
        updateMany: rndReportVersionUpdateMany,
        create: rndReportVersionCreate,
      },
    } as never;

    const snapshot = await generateAndLinkRndReportSnapshot(db, {
      companyId: "c1",
      jobId: "j1",
    });

    expect(snapshot).toEqual({ id: "snap-2" });
    expect(rndReportVersionUpdateMany).not.toHaveBeenCalled();
    expect(rndReportVersionCreate).not.toHaveBeenCalled();
  });
});
