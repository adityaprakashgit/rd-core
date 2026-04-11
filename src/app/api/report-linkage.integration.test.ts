import { randomUUID } from "node:crypto";
import net from "node:net";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

const mockedSession = vi.hoisted(() => ({
  getCurrentUserFromRequest: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getCurrentUserFromRequest: mockedSession.getCurrentUserFromRequest,
}));

import { GET as getTraceabilityLot } from "@/app/api/traceability/lot/[lotId]/route";
import { GET as getDocumentRegistry } from "@/app/api/documents/registry/route";
import { GET as getPacketDetail } from "@/app/api/packets/[id]/route";

type SeedLineage = {
  jobId: string;
  lotId: string;
  sampleId: string;
  packetId: string;
  oldSnapshotId: string;
  newSnapshotId: string;
};

type SeedContext = {
  companyId: string;
  opsUserId: string;
  rndUserId: string;
  lineageWithVersions: SeedLineage;
  fallbackLineage: SeedLineage;
};

async function cleanupByCompany(companyId: string) {
  await prisma.rndReportVersion.deleteMany({ where: { companyId } });
  await prisma.rndJobReview.deleteMany({ where: { rndJob: { companyId } } });
  await prisma.rndJobAttachment.deleteMany({ where: { rndJob: { companyId } } });
  await prisma.rndJobReading.deleteMany({ where: { rndJob: { companyId } } });
  await prisma.rndJob.deleteMany({ where: { companyId } });
  await prisma.packetAllocation.deleteMany({ where: { packet: { companyId } } });
  await prisma.packetEvent.deleteMany({ where: { packet: { companyId } } });
  await prisma.packetMedia.deleteMany({ where: { packet: { companyId } } });
  await prisma.packetSealLabel.deleteMany({ where: { packet: { companyId } } });
  await prisma.packetUsageLedger.deleteMany({ where: { companyId } });
  await prisma.packet.deleteMany({ where: { companyId } });
  await prisma.sampleEvent.deleteMany({ where: { sample: { companyId } } });
  await prisma.sampleMedia.deleteMany({ where: { sample: { companyId } } });
  await prisma.sampleSealLabel.deleteMany({ where: { sample: { companyId } } });
  await prisma.sample.deleteMany({ where: { companyId } });
  await prisma.inspection.deleteMany({ where: { job: { companyId } } });
  await prisma.inspectionLot.deleteMany({ where: { companyId } });
  await prisma.auditLog.deleteMany({ where: { job: { companyId } } });
  await prisma.reportSnapshot.deleteMany({ where: { job: { companyId } } });
  await prisma.inspectionJob.deleteMany({ where: { companyId } });
  await prisma.moduleWorkflowSettings.deleteMany({ where: { companyId } });
  await prisma.userProfile.deleteMany({ where: { user: { companyId } } });
  await prisma.user.deleteMany({ where: { companyId } });
}

async function seedLineage(input: {
  companyId: string;
  suffix: string;
  opsUserId: string;
  packetNo: number;
  withRndJobs: boolean;
  rndUserId: string;
}) {
  const jobId = `${input.suffix}-job`;
  const lotId = `${input.suffix}-lot`;
  const inspectionId = `${input.suffix}-inspection`;
  const sampleId = `${input.suffix}-sample`;
  const packetId = `${input.suffix}-packet`;

  await prisma.inspectionJob.create({
    data: {
      id: jobId,
      inspectionSerialNumber: `${input.suffix}-JOB`,
      companyId: input.companyId,
      clientName: "Integration Client",
      commodity: "Commodity",
      status: "IN_PROGRESS",
      createdByUserId: input.opsUserId,
    },
  });

  await prisma.inspectionLot.create({
    data: {
      id: lotId,
      jobId,
      companyId: input.companyId,
      lotNumber: `${input.suffix}-LOT`,
      status: "IN_PROGRESS",
    },
  });

  await prisma.inspection.create({
    data: {
      id: inspectionId,
      jobId,
      lotId,
      inspectorId: input.opsUserId,
      inspectionStatus: "IN_PROGRESS",
      decisionStatus: "READY_FOR_SAMPLING",
    },
  });

  await prisma.sample.create({
    data: {
      id: sampleId,
      companyId: input.companyId,
      jobId,
      lotId,
      inspectionId,
      sampleCode: `${input.suffix}-SMP`,
      sampleStatus: "READY_FOR_PACKETING",
      createdById: input.opsUserId,
    },
  });

  await prisma.packet.create({
    data: {
      id: packetId,
      companyId: input.companyId,
      jobId,
      lotId,
      sampleId,
      packetCode: `${input.suffix}-PKT`,
      packetNo: input.packetNo,
      packetStatus: "AVAILABLE",
      packetWeight: 10,
      packetUnit: "KG",
      packetType: "TESTING",
      createdById: input.opsUserId,
    },
  });

  await prisma.packetAllocation.create({
    data: {
      packetId,
      allocationStatus: "ALLOCATED",
    },
  });

  const oldSnapshot = await prisma.reportSnapshot.create({
    data: {
      jobId,
      data: { version: "old" },
      createdAt: new Date("2026-04-09T10:00:00.000Z"),
    },
  });
  const newSnapshot = await prisma.reportSnapshot.create({
    data: {
      jobId,
      data: { version: "new" },
      createdAt: new Date("2026-04-10T10:00:00.000Z"),
    },
  });

  if (input.withRndJobs) {
    const firstRnd = await prisma.rndJob.create({
      data: {
        rndJobNumber: `${input.suffix}-RND-001`,
        companyId: input.companyId,
        parentJobId: jobId,
        lotId,
        sampleId,
        packetId,
        status: "COMPLETED",
        resultPrecedence: "SUPERSEDED",
        jobType: "INITIAL_TEST",
        assignedToId: input.rndUserId,
      },
    });
    const secondRnd = await prisma.rndJob.create({
      data: {
        rndJobNumber: `${input.suffix}-RND-002`,
        companyId: input.companyId,
        parentJobId: jobId,
        lotId,
        sampleId,
        packetId,
        previousRndJobId: firstRnd.id,
        status: "APPROVED",
        resultPrecedence: "ACTIVE",
        jobType: "RETEST",
        assignedToId: input.rndUserId,
      },
    });

    await prisma.rndReportVersion.createMany({
      data: [
        {
          companyId: input.companyId,
          parentJobId: jobId,
          sampleId,
          rndJobId: firstRnd.id,
          reportSnapshotId: oldSnapshot.id,
          precedence: "SUPERSEDED",
        },
        {
          companyId: input.companyId,
          parentJobId: jobId,
          sampleId,
          rndJobId: secondRnd.id,
          reportSnapshotId: newSnapshot.id,
          precedence: "ACTIVE",
        },
      ],
    });
  }

  return {
    jobId,
    lotId,
    sampleId,
    packetId,
    oldSnapshotId: oldSnapshot.id,
    newSnapshotId: newSnapshot.id,
  };
}

describe("DB integration: traceability/documents report precedence labels", () => {
  let seed: SeedContext;
  let dbAvailable = false;

  beforeAll(async () => {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      dbAvailable = false;
      return;
    }

    try {
      const parsed = new URL(dbUrl);
      const host = parsed.hostname;
      const port = Number(parsed.port || 5432);
      dbAvailable = await new Promise<boolean>((resolve) => {
        const socket = net.createConnection({ host, port });
        socket.setTimeout(1500);
        socket.once("connect", () => {
          socket.destroy();
          resolve(true);
        });
        socket.once("timeout", () => {
          socket.destroy();
          resolve(false);
        });
        socket.once("error", () => {
          socket.destroy();
          resolve(false);
        });
      });
    } catch {
      dbAvailable = false;
    }
  });

  beforeEach(async () => {
    if (!dbAvailable) return;
    vi.clearAllMocks();

    const suffix = `it-rpt-link-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const companyId = `${suffix}-co`;
    const opsUserId = `${suffix}-ops`;
    const rndUserId = `${suffix}-rnd`;

    mockedSession.getCurrentUserFromRequest.mockResolvedValue({
      id: opsUserId,
      companyId,
      role: "OPERATIONS",
    });

    await prisma.user.createMany({
      data: [
        {
          id: opsUserId,
          companyId,
          email: `${opsUserId}@example.test`,
          role: "OPERATIONS",
          isActive: true,
        },
        {
          id: rndUserId,
          companyId,
          email: `${rndUserId}@example.test`,
          role: "RND",
          isActive: true,
        },
      ],
    });

    const lineageWithVersions = await seedLineage({
      companyId,
      suffix: `${suffix}-v`,
      opsUserId,
      packetNo: 1,
      withRndJobs: true,
      rndUserId,
    });
    const fallbackLineage = await seedLineage({
      companyId,
      suffix: `${suffix}-f`,
      opsUserId,
      packetNo: 2,
      withRndJobs: false,
      rndUserId,
    });

    seed = {
      companyId,
      opsUserId,
      rndUserId,
      lineageWithVersions,
      fallbackLineage,
    };
  });

  afterEach(async () => {
    if (!dbAvailable) return;
    await cleanupByCompany(seed.companyId);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns active/previous report labels for linked lineage and legacy available labels for unlinked lineage", async () => {
    if (!dbAvailable) return;

    const traceabilityResponse = await getTraceabilityLot(
      new NextRequest(`http://localhost/api/traceability/lot/${seed.lineageWithVersions.lotId}`),
      { params: Promise.resolve({ lotId: seed.lineageWithVersions.lotId }) },
    );
    expect(traceabilityResponse.status).toBe(200);
    const traceabilityPayload = (await traceabilityResponse.json()) as {
      coa: { latestSnapshotId: string | null; previousSnapshotIds: string[] };
      reports: {
        active: { snapshotId: string | null; status: string };
        previous: Array<{ snapshotId: string; status: string }>;
      };
      dispatches: Array<{ currentForDispatchSnapshotId: string | null; currentForDispatchUrl: string | null }>;
      relatedDocuments: Array<{ id: string; status: string }>;
    };

    expect(traceabilityPayload.coa.latestSnapshotId).toBe(seed.lineageWithVersions.newSnapshotId);
    expect(traceabilityPayload.coa.previousSnapshotIds).toContain(seed.lineageWithVersions.oldSnapshotId);
    expect(traceabilityPayload.reports.active.snapshotId).toBe(seed.lineageWithVersions.newSnapshotId);
    expect(traceabilityPayload.reports.active.status).toBe("Active Report");
    expect(traceabilityPayload.reports.previous).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          snapshotId: seed.lineageWithVersions.oldSnapshotId,
          status: "Previous Report",
        }),
      ]),
    );
    expect(traceabilityPayload.relatedDocuments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `report-${seed.lineageWithVersions.newSnapshotId}`,
          status: "Active Report",
        }),
        expect.objectContaining({
          id: `report-${seed.lineageWithVersions.oldSnapshotId}`,
          status: "Superseded",
        }),
      ]),
    );
    expect(traceabilityPayload.dispatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          currentForDispatchSnapshotId: seed.lineageWithVersions.newSnapshotId,
          currentForDispatchUrl: `/api/report/${seed.lineageWithVersions.newSnapshotId}`,
        }),
      ]),
    );

    const documentsResponse = await getDocumentRegistry(
      new NextRequest("http://localhost/api/documents/registry"),
    );
    expect(documentsResponse.status).toBe(200);
    const documentsPayload = (await documentsResponse.json()) as {
      rows: Array<{
        id: string;
        documentType: string;
        source: string;
        status: string;
        linkedActionUrl: string | null;
      }>;
    };
    const rows = documentsPayload.rows;

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `report-${seed.lineageWithVersions.newSnapshotId}`,
          documentType: "TEST_REPORT",
          source: "REPORT_SNAPSHOT",
          status: "Active Report",
        }),
        expect.objectContaining({
          id: `coa-${seed.lineageWithVersions.newSnapshotId}`,
          documentType: "COA",
          source: "REPORT_SNAPSHOT",
          status: "Active COA",
        }),
        expect.objectContaining({
          id: `report-${seed.lineageWithVersions.oldSnapshotId}`,
          documentType: "TEST_REPORT",
          source: "REPORT_SNAPSHOT",
          status: "Previous Report",
        }),
        expect.objectContaining({
          id: `coa-${seed.lineageWithVersions.oldSnapshotId}`,
          documentType: "COA",
          source: "REPORT_SNAPSHOT",
          status: "Previous Report",
        }),
        expect.objectContaining({
          id: `dispatch-${seed.lineageWithVersions.packetId}-${seed.lineageWithVersions.newSnapshotId}`,
          documentType: "DISPATCH_DOCUMENT",
          status: "Current for Dispatch",
          linkedActionUrl: `/api/report/${seed.lineageWithVersions.newSnapshotId}`,
        }),
      ]),
    );

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `report-${seed.fallbackLineage.newSnapshotId}`,
          documentType: "TEST_REPORT",
          source: "REPORT_SNAPSHOT",
          status: "Available",
        }),
        expect.objectContaining({
          id: `report-${seed.fallbackLineage.oldSnapshotId}`,
          documentType: "TEST_REPORT",
          source: "REPORT_SNAPSHOT",
          status: "Available",
        }),
      ]),
    );

    const packetResponse = await getPacketDetail(
      new NextRequest(`http://localhost/api/packets/${seed.lineageWithVersions.packetId}`),
      { params: Promise.resolve({ id: seed.lineageWithVersions.packetId }) },
    );
    expect(packetResponse.status).toBe(200);
    const packetPayload = (await packetResponse.json()) as {
      reportLinkage: {
        activeReport: { snapshotId: string } | null;
        activeCoa: { snapshotId: string } | null;
        currentForDispatch: { snapshotId: string; url: string } | null;
        previousReports: Array<{ snapshotId: string }>;
        selectionSource: string | null;
      };
    };
    expect(packetPayload.reportLinkage.activeReport?.snapshotId).toBe(seed.lineageWithVersions.newSnapshotId);
    expect(packetPayload.reportLinkage.activeCoa?.snapshotId).toBe(seed.lineageWithVersions.newSnapshotId);
    expect(packetPayload.reportLinkage.currentForDispatch).toEqual(
      expect.objectContaining({
        snapshotId: seed.lineageWithVersions.newSnapshotId,
        url: `/api/report/${seed.lineageWithVersions.newSnapshotId}`,
      }),
    );
    expect(packetPayload.reportLinkage.previousReports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ snapshotId: seed.lineageWithVersions.oldSnapshotId }),
      ]),
    );
    expect(packetPayload.reportLinkage.selectionSource).toBe("LINEAGE");
  });
});
