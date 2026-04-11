import { describe, expect, it, vi } from "vitest";

import { loadRndLineageLinkage, resolveActiveOutputForLineage } from "@/lib/rnd-report-linkage";

describe("loadRndLineageLinkage", () => {
  it("resolves active/superseded results and reports within one lineage", async () => {
    const db = {
      rndJob: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "r2",
            rndJobNumber: "RND-2026-0002",
            status: "APPROVED",
            resultPrecedence: "ACTIVE",
            reviewedAt: new Date("2026-04-10T10:00:00.000Z"),
            updatedAt: new Date("2026-04-10T10:00:00.000Z"),
          },
          {
            id: "r1",
            rndJobNumber: "RND-2026-0001",
            status: "COMPLETED",
            resultPrecedence: "SUPERSEDED",
            reviewedAt: new Date("2026-04-09T10:00:00.000Z"),
            updatedAt: new Date("2026-04-09T10:00:00.000Z"),
          },
        ]),
      },
      rndReportVersion: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "rv2",
            precedence: "ACTIVE",
            rndJobId: "r2",
            reportSnapshotId: "snap2",
            updatedAt: new Date("2026-04-10T11:00:00.000Z"),
            createdAt: new Date("2026-04-10T11:00:00.000Z"),
            rndJob: { id: "r2", rndJobNumber: "RND-2026-0002", status: "APPROVED" },
            reportSnapshot: { id: "snap2", createdAt: new Date("2026-04-10T11:00:00.000Z") },
          },
          {
            id: "rv1",
            precedence: "SUPERSEDED",
            rndJobId: "r1",
            reportSnapshotId: "snap1",
            updatedAt: new Date("2026-04-09T11:00:00.000Z"),
            createdAt: new Date("2026-04-09T11:00:00.000Z"),
            rndJob: { id: "r1", rndJobNumber: "RND-2026-0001", status: "COMPLETED" },
            reportSnapshot: { id: "snap1", createdAt: new Date("2026-04-09T11:00:00.000Z") },
          },
        ]),
      },
    } as never;

    const linkage = await loadRndLineageLinkage(db, {
      companyId: "c1",
      parentJobId: "j1",
      sampleId: "s1",
    });

    expect(linkage.activeResult?.id).toBe("r2");
    expect(linkage.supersededResults.map((row) => row.id)).toEqual(["r1"]);
    expect(linkage.activeReport?.id).toBe("rv2");
    expect(linkage.previousReports.map((row) => row.id)).toEqual(["rv1"]);
    expect(linkage.defaultReportUrl).toBe("/api/report/snap2");
    expect(linkage.defaultCoaUrl).toBe("/api/report/snap2");
  });

  it("does not infer active report when lineage has no report versions", async () => {
    const db = {
      rndJob: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      rndReportVersion: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as never;

    const linkage = await loadRndLineageLinkage(db, {
      companyId: "c1",
      parentJobId: "j1",
      sampleId: "s1",
    });

    expect(linkage.activeResult).toBeNull();
    expect(linkage.activeReport).toBeNull();
    expect(linkage.previousReports).toEqual([]);
    expect(linkage.defaultReportUrl).toBeNull();
    expect(linkage.defaultCoaUrl).toBeNull();
  });

  it("resolves current for dispatch from lineage-precedence report", async () => {
    const db = {
      rndJob: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      rndReportVersion: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "rv-active",
            precedence: "ACTIVE",
            rndJobId: "r2",
            reportSnapshotId: "snap-active",
            updatedAt: new Date("2026-04-10T11:00:00.000Z"),
            createdAt: new Date("2026-04-10T11:00:00.000Z"),
            rndJob: { id: "r2", rndJobNumber: "RND-2026-0002", status: "APPROVED" },
            reportSnapshot: { id: "snap-active", createdAt: new Date("2026-04-10T11:00:00.000Z") },
          },
          {
            id: "rv-old",
            precedence: "SUPERSEDED",
            rndJobId: "r1",
            reportSnapshotId: "snap-old",
            updatedAt: new Date("2026-04-09T11:00:00.000Z"),
            createdAt: new Date("2026-04-09T11:00:00.000Z"),
            rndJob: { id: "r1", rndJobNumber: "RND-2026-0001", status: "COMPLETED" },
            reportSnapshot: { id: "snap-old", createdAt: new Date("2026-04-09T11:00:00.000Z") },
          },
        ]),
      },
    } as never;

    const output = await resolveActiveOutputForLineage(db, {
      companyId: "c1",
      parentJobId: "j1",
      sampleId: "s1",
    });

    expect(output.selectionSource).toBe("LINEAGE");
    expect(output.activeReport?.snapshotId).toBe("snap-active");
    expect(output.activeCoa?.snapshotId).toBe("snap-active");
    expect(output.currentForDispatch?.snapshotId).toBe("snap-active");
    expect(output.previousReports).toEqual([
      expect.objectContaining({
        snapshotId: "snap-old",
        status: "Previous Report",
      }),
    ]);
  });

  it("falls back to latest job snapshot when no lineage report version exists", async () => {
    const db = {
      rndJob: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      rndReportVersion: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as never;

    const output = await resolveActiveOutputForLineage(db, {
      companyId: "c1",
      parentJobId: "j1",
      sampleId: "s1",
      fallbackSnapshots: [
        { id: "snap-old", createdAt: new Date("2026-04-09T00:00:00.000Z") },
        { id: "snap-new", createdAt: new Date("2026-04-10T00:00:00.000Z") },
      ],
    });

    expect(output.selectionSource).toBe("LEGACY_FALLBACK");
    expect(output.activeReport?.snapshotId).toBe("snap-new");
    expect(output.currentForDispatch?.url).toBe("/api/report/snap-new");
    expect(output.previousReports).toEqual([]);
  });
});
