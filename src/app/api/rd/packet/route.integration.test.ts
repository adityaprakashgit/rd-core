import { randomUUID } from "node:crypto";
import net from "node:net";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

const mockedSession = vi.hoisted(() => ({
  getCurrentUserFromRequest: vi.fn(),
}));

const mockedAudit = vi.hoisted(() => ({
  recordAuditLog: vi.fn(),
}));

const mockedMilestones = vi.hoisted(() => ({
  recomputeJobWorkflowMilestones: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getCurrentUserFromRequest: mockedSession.getCurrentUserFromRequest,
}));

vi.mock("@/lib/audit", () => ({
  recordAuditLog: mockedAudit.recordAuditLog,
}));

vi.mock("@/lib/workflow-milestones", () => ({
  recomputeJobWorkflowMilestones: mockedMilestones.recomputeJobWorkflowMilestones,
}));

import { PATCH } from "./route";

type SeedContext = {
  companyId: string;
  opsUserId: string;
  rndUserId: string;
  jobId: string;
  lotId: string;
  inspectionId: string;
  sampleId: string;
  packetId: string;
};

async function cleanupByCompany(companyId: string) {
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

describe("DB integration: packet submit to R&D creates one child RndJob", () => {
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
    const suffix = `it-rnd-handoff-${Date.now()}-${randomUUID().slice(0, 8)}`;
    seed = {
      companyId: suffix,
      opsUserId: `${suffix}-ops`,
      rndUserId: `${suffix}-rnd`,
      jobId: `${suffix}-job`,
      lotId: `${suffix}-lot`,
      inspectionId: `${suffix}-inspection`,
      sampleId: `${suffix}-sample`,
      packetId: `${suffix}-packet`,
    };

    mockedSession.getCurrentUserFromRequest.mockResolvedValue({
      id: seed.opsUserId,
      companyId: seed.companyId,
      role: "OPERATIONS",
    });
    mockedAudit.recordAuditLog.mockResolvedValue(undefined);
    mockedMilestones.recomputeJobWorkflowMilestones.mockResolvedValue(undefined);

    await prisma.user.createMany({
      data: [
        {
          id: seed.opsUserId,
          companyId: seed.companyId,
          email: `${seed.opsUserId}@example.test`,
          role: "OPERATIONS",
          isActive: true,
        },
        {
          id: seed.rndUserId,
          companyId: seed.companyId,
          email: `${seed.rndUserId}@example.test`,
          role: "RND",
          isActive: true,
        },
      ],
    });

    await prisma.inspectionJob.create({
      data: {
        id: seed.jobId,
        inspectionSerialNumber: `${suffix}-JOB`,
        companyId: seed.companyId,
        clientName: "Integration Client",
        commodity: "Integration Commodity",
        status: "IN_PROGRESS",
        createdByUserId: seed.opsUserId,
      },
    });

    await prisma.inspectionLot.create({
      data: {
        id: seed.lotId,
        jobId: seed.jobId,
        companyId: seed.companyId,
        lotNumber: `${suffix}-LOT`,
        status: "IN_PROGRESS",
      },
    });

    await prisma.inspection.create({
      data: {
        id: seed.inspectionId,
        jobId: seed.jobId,
        lotId: seed.lotId,
        inspectorId: seed.opsUserId,
        inspectionStatus: "IN_PROGRESS",
        decisionStatus: "READY_FOR_SAMPLING",
      },
    });

    await prisma.sample.create({
      data: {
        id: seed.sampleId,
        companyId: seed.companyId,
        jobId: seed.jobId,
        lotId: seed.lotId,
        inspectionId: seed.inspectionId,
        sampleCode: `${suffix}-SMP`,
        sampleStatus: "READY_FOR_PACKETING",
        createdById: seed.opsUserId,
      },
    });

    await prisma.packet.create({
      data: {
        id: seed.packetId,
        companyId: seed.companyId,
        jobId: seed.jobId,
        lotId: seed.lotId,
        sampleId: seed.sampleId,
        packetCode: `${suffix}-PKT`,
        packetNo: 1,
        packetStatus: "AVAILABLE",
        packetWeight: 10,
        packetUnit: "KG",
        packetType: "TESTING",
        createdById: seed.opsUserId,
      },
    });

    await prisma.packetAllocation.create({
      data: {
        packetId: seed.packetId,
        allocationStatus: "AVAILABLE",
      },
    });
  });

  afterEach(async () => {
    if (!dbAvailable) return;
    await cleanupByCompany(seed.companyId);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("persists exactly one linked initial R&D child job on submit and remains idempotent on resubmit", async () => {
    if (!dbAvailable) {
      // Environment guard: this integration test requires a reachable DATABASE_URL.
      return;
    }

    const submitPayload = {
      packetId: seed.packetId,
      markSubmittedToRnd: true,
      handedOverToRndTo: seed.rndUserId,
    };

    const submitResponse = await PATCH({
      json: async () => submitPayload,
    } as NextRequest);

    expect(submitResponse.status).toBe(200);

    const firstCount = await prisma.rndJob.count({
      where: {
        companyId: seed.companyId,
        packetId: seed.packetId,
        previousRndJobId: null,
      },
    });
    expect(firstCount).toBe(1);

    const created = await prisma.rndJob.findFirstOrThrow({
      where: {
        companyId: seed.companyId,
        packetId: seed.packetId,
        previousRndJobId: null,
      },
      select: {
        parentJobId: true,
        lotId: true,
        sampleId: true,
        packetId: true,
        status: true,
        jobType: true,
        assignedToId: true,
      },
    });

    expect(created.parentJobId).toBe(seed.jobId);
    expect(created.lotId).toBe(seed.lotId);
    expect(created.sampleId).toBe(seed.sampleId);
    expect(created.packetId).toBe(seed.packetId);
    expect(created.status).toBe("CREATED");
    expect(created.jobType).toBe("INITIAL_TEST");
    expect(created.assignedToId).toBe(seed.rndUserId);

    const resubmitResponse = await PATCH({
      json: async () => submitPayload,
    } as NextRequest);

    expect(resubmitResponse.status).toBe(200);

    const secondCount = await prisma.rndJob.count({
      where: {
        companyId: seed.companyId,
        packetId: seed.packetId,
        previousRndJobId: null,
      },
    });
    expect(secondCount).toBe(1);

    const nonSubmitResponse = await PATCH({
      json: async () => ({
        packetId: seed.packetId,
        remarks: "non-submit control",
      }),
    } as NextRequest);
    expect(nonSubmitResponse.status).toBe(200);

    const afterControlCount = await prisma.rndJob.count({
      where: {
        companyId: seed.companyId,
        packetId: seed.packetId,
        previousRndJobId: null,
      },
    });
    expect(afterControlCount).toBe(1);
  });
});
