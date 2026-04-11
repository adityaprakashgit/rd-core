import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { defaultModuleWorkflowSettings } from "@/lib/module-workflow-policy";

const mocks = vi.hoisted(() => ({
  authorizeMock: vi.fn(),
  getCurrentUserFromRequestMock: vi.fn(),
  recordAuditLogMock: vi.fn(),
  recomputeJobWorkflowMilestonesMock: vi.fn(),
  generateRndJobNumberMock: vi.fn(),
  transactionMock: vi.fn(),
  moduleWorkflowSettingsUpsertMock: vi.fn(),
  packetFindUniqueMock: vi.fn(),
  packetUpdateMock: vi.fn(),
  packetAllocationUpsertMock: vi.fn(),
  packetEventCreateMock: vi.fn(),
  userFindFirstMock: vi.fn(),
  rndJobFindFirstMock: vi.fn(),
  rndJobCreateMock: vi.fn(),
  inspectionJobFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/rbac", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rbac")>("@/lib/rbac");
  return {
    ...actual,
    authorize: mocks.authorizeMock,
  };
});

vi.mock("@/lib/session", () => ({
  getCurrentUserFromRequest: mocks.getCurrentUserFromRequestMock,
}));

vi.mock("@/lib/audit", () => ({
  recordAuditLog: mocks.recordAuditLogMock,
}));

vi.mock("@/lib/workflow-milestones", () => ({
  recomputeJobWorkflowMilestones: mocks.recomputeJobWorkflowMilestonesMock,
}));

vi.mock("@/lib/rnd-workflow", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rnd-workflow")>("@/lib/rnd-workflow");
  return {
    ...actual,
    generateRndJobNumber: mocks.generateRndJobNumberMock,
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transactionMock,
  },
}));

import { PATCH } from "./route";

function buildPacketRecord(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "packet-1",
    companyId: "company-1",
    jobId: "job-1",
    lotId: "lot-1",
    sampleId: "sample-1",
    packetNo: 1,
    packetCode: "PKT-0001",
    packetStatus: "AVAILABLE",
    packetQuantity: null,
    packetWeight: 10,
    packetUnit: "KG",
    packetType: "TESTING",
    remarks: "packet remarks",
    readyAt: new Date("2026-04-10T09:00:00.000Z"),
    submittedToRndAt: null,
    submittedToRndBy: null,
    createdById: "ops-1",
    createdAt: new Date("2026-04-10T08:00:00.000Z"),
    updatedAt: new Date("2026-04-10T08:00:00.000Z"),
    sample: {
      id: "sample-1",
      sampleQuantity: null,
      sampleUnit: null,
      packets: [
        {
          id: "packet-1",
          packetWeight: 10,
          packetQuantity: null,
          packetUnit: "KG",
          allocation: {
            allocationStatus: "AVAILABLE",
          },
        },
      ],
    },
    lot: {
      id: "lot-1",
      lotNumber: "LOT-1",
    },
    job: {
      id: "job-1",
      companyId: "company-1",
      status: "IN_PROGRESS",
      inspectionSerialNumber: "JOB-0001",
    },
    sealLabel: {
      sealedAt: new Date("2026-04-10T08:30:00.000Z"),
      labeledAt: new Date("2026-04-10T08:30:00.000Z"),
    },
    allocation: {
      allocationStatus: "AVAILABLE",
      allocatedToType: null,
      allocatedToId: null,
      allocatedAt: null,
    },
    media: [],
    events: [],
    ...overrides,
  };
}

describe("/api/rd/packet PATCH submit-to-R&D handoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getCurrentUserFromRequestMock.mockResolvedValue({
      id: "ops-1",
      companyId: "company-1",
      role: "OPERATIONS",
    });
    mocks.authorizeMock.mockReturnValue(undefined);
    mocks.recordAuditLogMock.mockResolvedValue(undefined);
    mocks.recomputeJobWorkflowMilestonesMock.mockResolvedValue(undefined);
    mocks.generateRndJobNumberMock.mockResolvedValue("RND-2026-0001");
    mocks.moduleWorkflowSettingsUpsertMock.mockResolvedValue({
      id: "settings-1",
      companyId: "company-1",
      createdAt: new Date("2026-04-10T00:00:00.000Z"),
      updatedAt: new Date("2026-04-10T00:00:00.000Z"),
      ...defaultModuleWorkflowSettings,
    });
    mocks.userFindFirstMock.mockResolvedValue({ id: "rnd-user-1" });
    mocks.rndJobFindFirstMock.mockResolvedValue(null);
    mocks.rndJobCreateMock.mockResolvedValue({
      id: "rnd-job-1",
      rndJobNumber: "RND-2026-0001",
    });
    mocks.inspectionJobFindUniqueMock.mockResolvedValue({
      deadline: new Date("2026-04-20T00:00:00.000Z"),
    });
    mocks.packetUpdateMock.mockResolvedValue(undefined);
    mocks.packetAllocationUpsertMock.mockResolvedValue(undefined);
    mocks.packetEventCreateMock.mockResolvedValue(undefined);

    mocks.packetFindUniqueMock
      .mockResolvedValueOnce(buildPacketRecord())
      .mockResolvedValueOnce(buildPacketRecord())
      .mockResolvedValueOnce(buildPacketRecord());

    mocks.transactionMock.mockImplementation(async (callback: (tx: Record<string, unknown>) => Promise<unknown>) => {
      const tx = {
        moduleWorkflowSettings: {
          upsert: mocks.moduleWorkflowSettingsUpsertMock,
        },
        packet: {
          findUnique: mocks.packetFindUniqueMock,
          update: mocks.packetUpdateMock,
        },
        packetAllocation: {
          upsert: mocks.packetAllocationUpsertMock,
        },
        packetEvent: {
          create: mocks.packetEventCreateMock,
        },
        user: {
          findFirst: mocks.userFindFirstMock,
        },
        rndJob: {
          findFirst: mocks.rndJobFindFirstMock,
          create: mocks.rndJobCreateMock,
        },
        inspectionJob: {
          findUnique: mocks.inspectionJobFindUniqueMock,
        },
        packetMedia: {
          findFirst: vi.fn(),
          update: vi.fn(),
          create: vi.fn(),
        },
        packetSealLabel: {
          upsert: vi.fn(),
        },
      };
      return callback(tx);
    });
  });

  it("accepts submit action and creates exactly one linked initial R&D child job", async () => {
    const response = await PATCH(
      {
        json: async () => ({
          packetId: "packet-1",
          markSubmittedToRnd: true,
          handedOverToRndTo: "rnd-user-1",
        }),
      } as NextRequest,
    );

    expect(response.status).toBe(200);
    expect(mocks.rndJobCreateMock).toHaveBeenCalledTimes(1);
    expect(mocks.rndJobCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          parentJobId: "job-1",
          lotId: "lot-1",
          sampleId: "sample-1",
          packetId: "packet-1",
          status: "CREATED",
          jobType: "INITIAL_TEST",
          assignedToId: "rnd-user-1",
        }),
      }),
    );
    expect(mocks.packetEventCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          packetId: "packet-1",
          eventType: "PACKET_SUBMITTED_TO_RND",
        }),
      }),
    );
    expect(mocks.recomputeJobWorkflowMilestonesMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        companyId: "company-1",
        handedOverToRndTo: "rnd-user-1",
      }),
    );
  });

  it("is idempotent for the same packet submit when initial R&D job already exists", async () => {
    mocks.rndJobFindFirstMock.mockResolvedValueOnce({ id: "existing-rnd-job" });

    const response = await PATCH(
      {
        json: async () => ({
          packetId: "packet-1",
          markSubmittedToRnd: true,
          handedOverToRndTo: "rnd-user-1",
        }),
      } as NextRequest,
    );

    expect(response.status).toBe(200);
    expect(mocks.rndJobCreateMock).not.toHaveBeenCalled();
    expect(mocks.packetEventCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "PACKET_SUBMITTED_TO_RND",
        }),
      }),
    );
  });

  it("keeps non-submit packet update flow compatible and does not create R&D job", async () => {
    const response = await PATCH(
      {
        json: async () => ({
          packetId: "packet-1",
          remarks: "Updated without R&D handoff",
        }),
      } as NextRequest,
    );

    expect(response.status).toBe(200);
    expect(mocks.rndJobFindFirstMock).not.toHaveBeenCalled();
    expect(mocks.rndJobCreateMock).not.toHaveBeenCalled();
    expect(mocks.packetUpdateMock).toHaveBeenCalled();
  });
});
