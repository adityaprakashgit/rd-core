import { describe, expect, it } from "vitest";

import type { PacketRecord } from "@/types/inspection";

import {
  getPacketReadiness,
  getPacketReadinessBlockers,
  hasPacketDetails,
  hasPacketSealAndLabel,
} from "./packet-management";

function buildPacket(overrides?: Partial<PacketRecord>): PacketRecord {
  return {
    id: "packet-1",
    companyId: "company-1",
    jobId: "job-1",
    lotId: "lot-1",
    sampleId: "sample-1",
    packetNo: 1,
    packetCode: "PKT-1",
    packetStatus: "CREATED",
    packetWeight: 10,
    packetUnit: "KG",
    packetType: "LAB_TEST_PACKET",
    remarks: null,
    readyAt: null,
    submittedToRndAt: null,
    submittedToRndBy: null,
    createdById: "ops-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    allocation: null,
    media: [
      {
        id: "media-1",
        packetId: "packet-1",
        mediaType: "PACKET_LABEL",
        fileUrl: "https://example.test/label.jpg",
        remarks: null,
        capturedById: "ops-1",
        capturedAt: new Date(),
        createdAt: new Date(),
      },
      {
        id: "media-2",
        packetId: "packet-1",
        mediaType: "PACKET_SEALED",
        fileUrl: "https://example.test/sealed.jpg",
        remarks: null,
        capturedById: "ops-1",
        capturedAt: new Date(),
        createdAt: new Date(),
      },
    ],
    sealLabel: {
      id: "seal-1",
      packetId: "packet-1",
      sealNo: "123456789",
      labelText: "PKT-1",
      labelCode: "PKT-1",
      sealedAt: new Date(),
      labeledAt: new Date(),
      sealStatus: "COMPLETED",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    events: [],
    ...overrides,
  };
}

describe("packet readiness blockers", () => {
  it("returns structured sample packet evidence blockers for missing packet details and proof", () => {
    const readiness = getPacketReadiness(
      buildPacket({
        packetWeight: null,
        packetUnit: null,
        packetType: null,
        media: [],
        sealLabel: {
          id: "seal-1",
          packetId: "packet-1",
          sealNo: "",
          labelText: "PKT-1",
          labelCode: "PKT-1",
          sealedAt: null,
          labeledAt: null,
          sealStatus: "PENDING",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }),
    );

    expect(readiness.isReady).toBe(false);
    expect(readiness.blockers).toHaveLength(4);
    expect(readiness.blockers[0]).toMatchObject({
      level: "sample-packet",
      groupTitle: "Sample packet evidence",
      proofLabel: "Packet details",
      locationLabel: "Packet Management > Packet card > Details",
    });
    expect(readiness.blockers.map((blocker) => blocker.detail)).toEqual(readiness.missing);
    expect(readiness.missing[0]).toContain("Packet details are incomplete");
    expect(readiness.missing[1]).toContain("Packet label photo is missing");
    expect(readiness.missing[2]).toContain("Sealed packet photo is missing");
    expect(readiness.missing[3]).toContain("Seal number is missing");
  });

  it("keeps a complete packet ready for availability", () => {
    const readiness = getPacketReadiness(buildPacket());

    expect(readiness.isReady).toBe(true);
    expect(readiness.blockers).toHaveLength(0);
    expect(hasPacketDetails(buildPacket())).toBe(true);
    expect(hasPacketSealAndLabel(buildPacket().sealLabel)).toBe(true);
  });

  it("describes a missing packet record as sample packet evidence", () => {
    const blockers = getPacketReadinessBlockers(null);

    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toMatchObject({
      level: "sample-packet",
      groupTitle: "Sample packet evidence",
      proofLabel: "Packet record",
      locationLabel: "Packet Management > Step 1 Create packet plan",
      actionLabel: "Create packet",
    });
    expect(blockers[0].detail).toContain("Packet record has not been created yet.");
  });
});
