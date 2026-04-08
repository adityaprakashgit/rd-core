import type {
  PacketAllocationRecord,
  PacketMediaRecord,
  PacketRecord,
  PacketSealLabelRecord,
} from "@/types/inspection";

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

const readinessMediaRequirements: PacketMediaType[] = ["PACKET_LABEL", "PACKET_SEALED"];

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
) {
  const serial = sanitizeSegment(inspectionSerialNumber) || "JOB";
  const lot = sanitizeSegment(lotNumber) || "LOT";
  return `PKT-${serial}-${lot}-${String(packetNo).padStart(3, "0")}`;
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
    typeof packet?.packetQuantity === "number" &&
      packet.packetQuantity > 0 &&
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

export function getPacketReadiness(packet: PacketRecord | null | undefined) {
  const missing: string[] = [];

  if (!packet) {
    missing.push("Create packet");
    return { isReady: false, missing };
  }

  if (!hasPacketDetails(packet)) {
    missing.push("Capture quantity, unit, and packet type");
  }

  for (const mediaType of getRequiredMissingPacketMedia(packet)) {
    if (mediaType === "PACKET_LABEL") {
      missing.push("Upload packet label photo");
    }
    if (mediaType === "PACKET_SEALED") {
      missing.push("Upload sealed packet photo");
    }
  }

  if (!hasPacketSealAndLabel(packet.sealLabel)) {
    missing.push("Add seal no.");
  }

  return {
    isReady: missing.length === 0,
    missing,
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
