import { describe, expect, it } from "vitest";

import { toModuleWorkflowPolicy } from "@/lib/module-workflow-policy";

import { computeJobWorkflowMilestoneUpdate } from "./workflow-milestones";

const settings = toModuleWorkflowPolicy(null);

function buildPacket(overrides?: Partial<{ id: string; packetWeight: number | null; packetUnit: string | null; submittedToRndAt: Date | null; submittedToRndBy: string | null }>) {
  return {
    id: overrides?.id ?? "packet-1",
    packetWeight: overrides && "packetWeight" in overrides ? overrides.packetWeight ?? null : 10,
    packetUnit: overrides && "packetUnit" in overrides ? overrides.packetUnit ?? null : "KG",
    submittedToRndAt: overrides && "submittedToRndAt" in overrides ? overrides.submittedToRndAt ?? null : null,
    submittedToRndBy: overrides && "submittedToRndBy" in overrides ? overrides.submittedToRndBy ?? null : null,
  };
}

function buildLot(
  id: string,
  overrides?: Partial<{
    createdAt: Date;
    mediaFiles: Array<{ category: string }>;
    sentToAdminAt: Date | null;
    sentToAdminBy: string | null;
    decisionAt: Date | null;
    decisionBy: string | null;
    decisionOutcome: "PASS" | "HOLD" | "REJECT" | null;
    decisionStatus: string | null;
    sampleId: string | null;
    homogeneousProofDone: boolean;
    homogenizedAt: Date | null;
    sampleSealNo: string | null;
    lotSealNo: string | null;
    packets: ReturnType<typeof buildPacket>[];
  }>,
) {
  return {
    id,
    createdAt: overrides?.createdAt ?? new Date("2026-04-09T04:00:00.000Z"),
    lotNumber: `LOT-${id}`,
    sealNumber: overrides?.lotSealNo ?? null,
    mediaFiles:
      overrides?.mediaFiles ??
      settings.images.requiredImageCategories.map((label) => ({
        category: (
          {
            "Bag photo with visible LOT no": "BAG_WITH_LOT_NO",
            "Material in bag": "MATERIAL_VISIBLE",
            "During Sampling Photo": "SAMPLING_IN_PROGRESS",
            "Sample Completion": "SEALED_BAG",
            "Seal on bag": "SEAL_CLOSEUP",
            "Bag condition": "BAG_CONDITION",
          } as Record<string, string>
        )[label] ?? label,
      })),
    inspection: {
      sentToAdminAt: overrides?.sentToAdminAt ?? null,
      sentToAdminBy: overrides?.sentToAdminBy ?? null,
      decisionAt: overrides?.decisionAt ?? null,
      decisionBy: overrides?.decisionBy ?? null,
      decisionOutcome: overrides?.decisionOutcome ?? null,
      decisionStatus: overrides?.decisionStatus ?? null,
    },
    sample:
      overrides?.sampleId === null
        ? null
        : {
            id: overrides?.sampleId ?? `sample-${id}`,
            homogeneousProofDone: overrides?.homogeneousProofDone ?? true,
            homogenizedAt: overrides?.homogenizedAt ?? null,
            sealLabel: {
              sealNo: overrides?.sampleSealNo ?? "SEAL-1",
            },
            packets: overrides?.packets ?? [buildPacket({ id: `packet-${id}` })],
          },
  };
}

function buildJob(overrides?: Partial<{ lots: ReturnType<typeof buildLot>[]; handedOverToRndTo: string | null }>) {
  return {
    id: "job-1",
    companyId: "company-1",
    createdAt: new Date("2026-04-09T03:00:00.000Z"),
    jobStartedAt: null,
    sentToAdminAt: null,
    sentToAdminBy: null,
    adminDecisionAt: null,
    adminDecisionBy: null,
    adminDecisionStatus: null,
    operationsCompletedAt: null,
    handedOverToRndAt: null,
    handedOverToRndBy: null,
    handedOverToRndTo: overrides?.handedOverToRndTo ?? null,
    lots: overrides?.lots ?? [],
  };
}

describe("workflow milestone rollups", () => {
  it("sets jobStartedAt from the first lot", () => {
    const lotCreatedAt = new Date("2026-04-09T05:00:00.000Z");
    const update = computeJobWorkflowMilestoneUpdate(buildJob({ lots: [buildLot("1", { createdAt: lotCreatedAt })] }), settings);
    expect(update.jobStartedAt).toEqual(lotCreatedAt);
  });

  it("does not roll up sentToAdminAt until all lots are submitted", () => {
    const update = computeJobWorkflowMilestoneUpdate(
      buildJob({
        lots: [
          buildLot("1", { sentToAdminAt: new Date("2026-04-09T06:00:00.000Z"), sentToAdminBy: "ops-1" }),
          buildLot("2", { sentToAdminAt: null }),
        ],
      }),
      settings,
    );
    expect(update.sentToAdminAt).toBeUndefined();
  });

  it("rolls up admin decision only when all lots are decided", () => {
    const update = computeJobWorkflowMilestoneUpdate(
      buildJob({
        lots: [
          buildLot("1", { decisionAt: new Date("2026-04-09T07:00:00.000Z"), decisionBy: "manager-1", decisionOutcome: "PASS" }),
          buildLot("2", { decisionAt: null, decisionOutcome: null }),
        ],
      }),
      settings,
    );
    expect(update.adminDecisionAt).toBeUndefined();
    expect(update.adminDecisionStatus).toBeUndefined();
  });

  it("applies REJECT > HOLD > PASS precedence for mixed decisions", () => {
    const update = computeJobWorkflowMilestoneUpdate(
      buildJob({
        lots: [
          buildLot("1", { decisionAt: new Date("2026-04-09T07:00:00.000Z"), decisionBy: "manager-1", decisionOutcome: "PASS" }),
          buildLot("2", { decisionAt: new Date("2026-04-09T07:30:00.000Z"), decisionBy: "manager-1", decisionOutcome: "HOLD" }),
          buildLot("3", { decisionAt: new Date("2026-04-09T08:00:00.000Z"), decisionBy: "manager-1", decisionOutcome: "REJECT" }),
        ],
      }),
      settings,
    );
    expect(update.adminDecisionStatus).toBe("REJECT");
  });

  it("keeps operationsCompletedAt empty until all lots satisfy operations readiness", () => {
    const update = computeJobWorkflowMilestoneUpdate(
      buildJob({
        lots: [
          buildLot("1", { decisionOutcome: "PASS" }),
          buildLot("2", { decisionOutcome: "PASS", packets: [buildPacket({ packetWeight: null, packetUnit: null })] }),
        ],
      }),
      settings,
    );
    expect(update.operationsCompletedAt).toBeUndefined();
  });

  it("does not roll up handover until all packets are submitted", () => {
    const update = computeJobWorkflowMilestoneUpdate(
      buildJob({
        lots: [
          buildLot("1", { packets: [buildPacket({ id: "packet-1", submittedToRndAt: new Date("2026-04-09T09:00:00.000Z"), submittedToRndBy: "ops-1" })] }),
          buildLot("2", { packets: [buildPacket({ id: "packet-2", submittedToRndAt: null, submittedToRndBy: null })] }),
        ],
      }),
      settings,
      { handedOverToRndTo: "rnd-1" },
    );
    expect(update.handedOverToRndAt).toBeUndefined();
    expect(update.handedOverToRndTo).toBeUndefined();
  });

  it("stores the handover target when all packets are submitted", () => {
    const update = computeJobWorkflowMilestoneUpdate(
      buildJob({
        lots: [
          buildLot("1", { packets: [buildPacket({ id: "packet-1", submittedToRndAt: new Date("2026-04-09T09:00:00.000Z"), submittedToRndBy: "ops-1" })] }),
          buildLot("2", { packets: [buildPacket({ id: "packet-2", submittedToRndAt: new Date("2026-04-09T09:15:00.000Z"), submittedToRndBy: "ops-1" })] }),
        ],
      }),
      settings,
      { handedOverToRndTo: "rnd-user-7" },
    );
    expect(update.handedOverToRndAt).toEqual(new Date("2026-04-09T09:15:00.000Z"));
    expect(update.handedOverToRndBy).toBe("ops-1");
    expect(update.handedOverToRndTo).toBe("rnd-user-7");
  });
});
