import type {
  PacketAllocationRecord,
  PacketMediaRecord,
  PacketRecord,
  PacketSealLabelRecord,
} from "@/types/inspection";
import { WORKFLOW_EVIDENCE_GROUPS } from "@/lib/evidence-definition";

export const PACKET_STATUSES = [
  "CREATED",
  "DETAILS_CAPTURED",
  "LABELED",
  "SEALED",
  "AVAILABLE",
  "RESERVED",
  "ALLOCATED",
  "USED",
  "BLOCKED",
] as const;

export const PACKET_TYPES = [
  "LAB_TEST_PACKET",
  "RETAIN_PACKET",
  "REF_PACKET",
  "BACKUP_PACKET",
] as const;

export const PACKET_MEDIA_TYPES = [
  "PACKET_LABEL",
  "PACKET_SEALED",
  "PACKET_CONDITION",
  "PACKET_GROUP_VIEW",
] as const;

export const PACKET_ALLOCATION_STATUSES = [
  "AVAILABLE",
  "RESERVED",
  "ALLOCATED",
  "USED",
  "BLOCKED",
] as const;

export type PacketStatus = (typeof PACKET_STATUSES)[number];
export type PacketType = (typeof PACKET_TYPES)[number];
export type PacketMediaType = (typeof PACKET_MEDIA_TYPES)[number];
export type PacketAllocationStatus = (typeof PACKET_ALLOCATION_STATUSES)[number];
export type PacketReadinessLevel = "sample-packet";
export type PacketReadinessBlocker = {
  key: string;
  level: PacketReadinessLevel;
  groupTitle: string;
  proofLabel: string;
  locationLabel: string;
  actionLabel: string;
  detail: string;
};

const readinessMediaRequirements: PacketMediaType[] = ["PACKET_LABEL", "PACKET_SEALED"];
const packetEvidenceGroup = WORKFLOW_EVIDENCE_GROUPS.find((group) => group.id === "packet") ?? null;
const packetEvidenceGroupTitle = packetEvidenceGroup?.title ?? "Sample packet evidence";

function buildPacketReadinessBlocker(
  key: string,
  proofLabel: string,
  locationLabel: string,
  actionLabel: string,
  detail: string,
): PacketReadinessBlocker {
  return {
    key,
    level: "sample-packet",
    groupTitle: packetEvidenceGroupTitle,
    proofLabel,
    locationLabel,
    actionLabel,
    detail: `${packetEvidenceGroupTitle}: ${detail}`,
  };
}

function sanitizeSegment(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20);
}

export function buildPacketCode(
  inspectionSerialNumber: string | null | undefined,
  lotNumber: string | null | undefined,
  packetNo: number,
  options?: {
    prefix?: string | null;
    sequenceFormat?: string | null;
  },
) {
  const configuredPrefix = sanitizeSegment(options?.prefix) || "PKT";
  const configuredSequenceLength = Math.max(
    3,
    Math.min(8, (options?.sequenceFormat ?? "").replace(/[^0]/g, "").length || 3),
  );
  const serial = sanitizeSegment(inspectionSerialNumber) || "JOB";
  const lot = sanitizeSegment(lotNumber) || "LOT";
  return `${configuredPrefix}-${serial}-${lot}-${String(packetNo).padStart(configuredSequenceLength, "0")}`;
}

export function isValidPacketCount(count: number) {
  return Number.isInteger(count) && count > 0 && count <= 50;
}

export function normalizePacketMediaType(value: unknown): PacketMediaType | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return PACKET_MEDIA_TYPES.includes(normalized as PacketMediaType)
    ? (normalized as PacketMediaType)
    : null;
}

export function mapPacketMediaByType(media: PacketMediaRecord[] | null | undefined) {
  return (media ?? []).reduce<Partial<Record<PacketMediaType, PacketMediaRecord>>>((acc, item) => {
    const mediaType = normalizePacketMediaType(item.mediaType);
    if (!mediaType) {
      return acc;
    }

    const existing = acc[mediaType];
    if (!existing || new Date(item.capturedAt).getTime() >= new Date(existing.capturedAt).getTime()) {
      acc[mediaType] = item;
    }
    return acc;
  }, {});
}

export function hasPacketDetails(packet: PacketRecord | null | undefined) {
  return Boolean(
    ((typeof packet?.packetWeight === "number" && packet.packetWeight > 0) ||
      (typeof packet?.packetQuantity === "number" && packet.packetQuantity > 0)) &&
      packet.packetUnit &&
      packet.packetType,
  );
}

export function hasPacketSealAndLabel(sealLabel: PacketSealLabelRecord | null | undefined) {
  return Boolean(
    sealLabel?.sealNo &&
      sealLabel.sealedAt,
  );
}

export function getRequiredMissingPacketMedia(packet: PacketRecord | null | undefined) {
  const mediaMap = mapPacketMediaByType(packet?.media);
  return readinessMediaRequirements.filter((type) => !mediaMap[type]?.fileUrl);
}

export function getPacketReadinessBlockers(packet: PacketRecord | null | undefined): PacketReadinessBlocker[] {
  const blockers: PacketReadinessBlocker[] = [];

  if (!packet) {
    blockers.push(
      buildPacketReadinessBlocker(
        "packet-missing",
        "Packet record",
        "Packet Management > Step 1 Create packet plan",
        "Create packet",
        "Packet record has not been created yet. Create the packet in Packet Management > Step 1 Create packet plan.",
      ),
    );
    return blockers;
  }

  if (!hasPacketDetails(packet)) {
    blockers.push(
      buildPacketReadinessBlocker(
        "packet-details",
        "Packet details",
        "Packet Management > Packet card > Details",
        "Save card",
        "Packet details are incomplete. Capture quantity, unit, and packet type in Packet Management > Packet card > Details.",
      ),
    );
  }

  for (const mediaType of getRequiredMissingPacketMedia(packet)) {
    if (mediaType === "PACKET_LABEL") {
      blockers.push(
        buildPacketReadinessBlocker(
          "packet-label-photo",
          "Packet label photo",
          "Packet Management > Packet card > Proof capture",
          "Capture photo",
          "Packet label photo is missing. Upload it in Packet Management > Packet card > Proof capture.",
        ),
      );
    }
    if (mediaType === "PACKET_SEALED") {
      blockers.push(
        buildPacketReadinessBlocker(
          "packet-sealed-photo",
          "Sealed packet photo",
          "Packet Management > Packet card > Proof capture",
          "Capture photo",
          "Sealed packet photo is missing. Upload it in Packet Management > Packet card > Proof capture with the seal number visible.",
        ),
      );
    }
  }

  if (!hasPacketSealAndLabel(packet.sealLabel)) {
    blockers.push(
      buildPacketReadinessBlocker(
        "packet-seal-number",
        "Seal number",
        "Packet Management > Packet card > Seal and label",
        "Save card",
        "Seal number is missing. Enter it in Packet Management > Packet card > Seal and label.",
      ),
    );
  }

  return blockers;
}

export function getPacketReadiness(packet: PacketRecord | null | undefined) {
  const blockers = getPacketReadinessBlockers(packet);
  const missing = blockers.map((blocker) => blocker.detail);

  return {
    isReady: missing.length === 0,
    missing,
    blockers,
  };
}

export function derivePacketStatus(
  packet: PacketRecord | null | undefined,
  allocation?: PacketAllocationRecord | null,
): PacketStatus {
  if (!packet) {
    return "CREATED";
  }

  const allocationStatus = allocation?.allocationStatus ?? packet.allocation?.allocationStatus ?? null;
  if (allocationStatus === "USED" || packet.packetStatus === "USED") {
    return "USED";
  }
  if (allocationStatus === "ALLOCATED" || packet.packetStatus === "ALLOCATED") {
    return "ALLOCATED";
  }
  if (allocationStatus === "RESERVED" || packet.packetStatus === "RESERVED") {
    return "RESERVED";
  }
  if (allocationStatus === "BLOCKED" && packet.packetStatus === "BLOCKED") {
    return "BLOCKED";
  }

  const readiness = getPacketReadiness(packet);
  if (readiness.isReady || packet.packetStatus === "AVAILABLE") {
    return "AVAILABLE";
  }

  if (hasPacketSealAndLabel(packet.sealLabel) || packet.packetStatus === "SEALED") {
    return "SEALED";
  }

  if (packet.sealLabel?.labelText || packet.sealLabel?.labelCode || packet.packetStatus === "LABELED") {
    return "LABELED";
  }

  if (hasPacketDetails(packet) || packet.packetStatus === "DETAILS_CAPTURED") {
    return "DETAILS_CAPTURED";
  }

  return "CREATED";
}

export function sumAllocatedPacketQuantity(packets: PacketRecord[]) {
  return packets.reduce((total, packet) => total + (typeof packet.packetQuantity === "number" ? packet.packetQuantity : 0), 0);
}

const MASS_UNIT_TO_GRAMS: Record<string, number> = {
  KG: 1000,
  G: 1,
  MG: 0.001,
};

function normalizeUnit(value: string | null | undefined) {
  return value?.trim().toUpperCase() ?? null;
}

export function toComparableQuantity(value: number | null | undefined, unit: string | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const normalizedUnit = normalizeUnit(unit);
  if (!normalizedUnit) {
    return null;
  }
  const factor = MASS_UNIT_TO_GRAMS[normalizedUnit];
  if (factor) {
    return {
      value: value * factor,
      dimension: "MASS" as const,
      unit: "G",
    };
  }
  if (normalizedUnit === "PCS") {
    return {
      value,
      dimension: "COUNT" as const,
      unit: "PCS",
    };
  }
  return null;
}
