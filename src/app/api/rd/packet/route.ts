import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit";
import {
  buildPacketCode,
  derivePacketStatus,
  getPacketReadiness,
  hasPacketDetails,
  hasPacketSealAndLabel,
  isValidPacketCount,
  normalizePacketMediaType,
  sumAllocatedPacketQuantity,
  toComparableQuantity,
  type PacketStatus,
} from "@/lib/packet-management";
import { buildModuleWorkflowSettingsCreate, toModuleWorkflowPolicy } from "@/lib/module-workflow-policy";
import { prisma } from "@/lib/prisma";
import { AuthorizationError, authorize } from "@/lib/rbac";
import { getCurrentUserFromRequest } from "@/lib/session";
import { deriveSampleStatus } from "@/lib/sample-management";
import { recomputeJobWorkflowMilestones } from "@/lib/workflow-milestones";
import type { PacketRecord, SampleRecord } from "@/types/inspection";

export const dynamic = "force-dynamic";

type PrismaLike = Prisma.TransactionClient | typeof prisma;

const publicUserSelect = {
  select: {
    profile: {
      select: {
        displayName: true,
        companyName: true,
        avatarUrl: true,
        jobTitle: true,
      },
    },
    role: true,
  },
} as const;

const packetInclude = {
  createdBy: publicUserSelect,
  sample: {
    select: {
      id: true,
      sampleCode: true,
      sampleQuantity: true,
      sampleUnit: true,
    },
  },
  lot: {
    select: {
      id: true,
      lotNumber: true,
      materialName: true,
    },
  },
  sealLabel: true,
  allocation: true,
  media: {
    orderBy: { capturedAt: "asc" },
    include: {
      capturedBy: publicUserSelect,
    },
  },
  events: {
    orderBy: { eventTime: "asc" },
    include: {
      performedBy: publicUserSelect,
    },
  },
} as const;

function jsonError(error: string, details: string, status: number) {
  return NextResponse.json({ error, details }, { status });
}

function normalizeText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

async function createPacketEvent(
  tx: Prisma.TransactionClient,
  input: {
    packetId: string;
    eventType: string;
    performedById?: string | null;
    remarks?: string | null;
    metadata?: Prisma.InputJsonValue;
  },
) {
  await tx.packetEvent.create({
    data: {
      packetId: input.packetId,
      eventType: input.eventType,
      performedById: input.performedById ?? null,
      remarks: input.remarks ?? null,
      metadata: input.metadata,
    },
  });
}

async function buildUniquePacketCode(
  tx: Prisma.TransactionClient,
  input: {
    inspectionSerialNumber: string | null | undefined;
    lotNumber: string | null | undefined;
    packetNo: number;
  },
) {
  const baseCode = buildPacketCode(input.inspectionSerialNumber, input.lotNumber, input.packetNo);
  let nextCode = baseCode;
  let suffix = 1;

  while (true) {
    const existing = await tx.packet.findUnique({
      where: { packetCode: nextCode },
      select: { id: true },
    });

    if (!existing) {
      return nextCode;
    }

    suffix += 1;
    nextCode = `${baseCode}-${suffix}`;
  }
}

async function getSampleScope(tx: PrismaLike, sampleId: string, companyId: string) {
  const sample = await tx.sample.findUnique({
    where: { id: sampleId },
    include: {
      lot: {
        select: {
          id: true,
          lotNumber: true,
        },
      },
      job: {
        select: {
          id: true,
          companyId: true,
          status: true,
          inspectionSerialNumber: true,
        },
      },
      sealLabel: true,
      media: true,
      packets: {
        include: {
          allocation: true,
        },
        orderBy: { packetNo: "asc" },
      },
    },
  });

  if (!sample || sample.companyId !== companyId || sample.job.companyId !== companyId) {
    throw new Error("FORBIDDEN");
  }

  if (sample.job.status === "LOCKED") {
    throw new Error("JOB_LOCKED");
  }

  return sample;
}

async function getPacketScope(tx: PrismaLike, packetId: string, companyId: string) {
  const packet = await tx.packet.findUnique({
    where: { id: packetId },
    include: {
      sample: {
        include: {
          packets: {
            include: {
              allocation: true,
            },
          },
        },
      },
      lot: {
        select: {
          id: true,
          lotNumber: true,
        },
      },
      job: {
        select: {
          id: true,
          companyId: true,
          status: true,
          inspectionSerialNumber: true,
        },
      },
      sealLabel: true,
      allocation: true,
      media: true,
    },
  });

  if (!packet || packet.companyId !== companyId || packet.job.companyId !== companyId) {
    throw new Error("FORBIDDEN");
  }

  if (packet.job.status === "LOCKED") {
    throw new Error("JOB_LOCKED");
  }

  return packet;
}

async function fetchPacketsBySample(tx: PrismaLike, sampleId: string) {
  return tx.packet.findMany({
    where: { sampleId },
    include: packetInclude,
    orderBy: [{ packetNo: "asc" }],
  });
}

async function fetchPacketsByJob(tx: PrismaLike, jobId: string) {
  return tx.packet.findMany({
    where: { jobId },
    include: packetInclude,
    orderBy: [{ lot: { lotNumber: "asc" } }, { packetNo: "asc" }],
  });
}

async function getWorkflowPolicy(tx: PrismaLike, companyId: string) {
  const settings = await tx.moduleWorkflowSettings.upsert({
    where: { companyId },
    update: {},
    create: buildModuleWorkflowSettingsCreate(companyId),
  });
  return toModuleWorkflowPolicy(settings);
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "READ_ONLY");

    const sampleId = request.nextUrl.searchParams.get("sampleId");
    const jobId = request.nextUrl.searchParams.get("jobId");

    if (!sampleId && !jobId) {
      return jsonError("Validation Error", "sampleId or jobId is required.", 400);
    }

    if (sampleId) {
      await getSampleScope(prisma, sampleId, currentUser.companyId);
      const packets = await fetchPacketsBySample(prisma, sampleId);
      return NextResponse.json(packets);
    }

    const job = await prisma.inspectionJob.findUnique({
      where: { id: jobId ?? "" },
      select: { id: true, companyId: true },
    });

    if (!job || job.companyId !== currentUser.companyId) {
      return jsonError("Forbidden", "Cross-company access is not allowed.", 403);
    }

    const packets = await fetchPacketsByJob(prisma, job.id);
    return NextResponse.json(packets);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }
    const message = error instanceof Error ? error.message : "Failed to load packet management data.";
    return jsonError("System Error", message, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "MANAGE_PACKET_WORKFLOW");

    const body = await request.json();
    const sampleId = typeof body?.sampleId === "string" ? body.sampleId.trim() : "";
    const planEntries = Array.isArray(body?.packets) ? body.packets : [];
    const requestedCount = typeof body?.count === "number" ? body.count : planEntries.length;

    if (!sampleId) {
      return jsonError("Validation Error", "sampleId is required.", 400);
    }
    if (!isValidPacketCount(requestedCount)) {
      return jsonError("Validation Error", "Packet count must be a whole number between 1 and 50.", 400);
    }

    const packets = await prisma.$transaction(async (tx) => {
      const sample = await getSampleScope(tx, sampleId, currentUser.companyId);
      const sampleStatus = deriveSampleStatus(sample as unknown as SampleRecord);
      if (sampleStatus !== "READY_FOR_PACKETING") {
        throw new Error("SAMPLE_NOT_READY");
      }

      const highestPacketNo = sample.packets.reduce((max, packet) => Math.max(max, packet.packetNo), 0);

      const plannedPackets = Array.from({ length: requestedCount }, (_, index) => {
        const entry = (planEntries[index] ?? {}) as Record<string, unknown>;
        return {
          packetNo: highestPacketNo + index + 1,
          packetQuantity: normalizeNumber(entry.packetQuantity),
          packetUnit: normalizeText(entry.packetUnit),
          packetType: normalizeText(entry.packetType),
          remarks: normalizeText(entry.remarks),
        };
      });

      const projectedQuantity =
        sumAllocatedPacketQuantity(sample.packets as unknown as PacketRecord[]) +
        plannedPackets.reduce((total, packet) => total + (packet.packetQuantity ?? 0), 0);

      if (sample.sampleQuantity && projectedQuantity > sample.sampleQuantity) {
        throw new Error("PACKET_QUANTITY_EXCEEDED");
      }

      const createdPackets = [];
      for (const plan of plannedPackets) {
        if (plan.packetQuantity !== null && plan.packetQuantity <= 0) {
          throw new Error("INVALID_PACKET_QUANTITY");
        }
        if (plan.packetQuantity !== null && !plan.packetUnit) {
          throw new Error("PACKET_UNIT_REQUIRED");
        }

        const packetCode = await buildUniquePacketCode(tx, {
          inspectionSerialNumber: sample.job.inspectionSerialNumber,
          lotNumber: sample.lot.lotNumber,
          packetNo: plan.packetNo,
        });
        const status = hasPacketDetails({
          id: "draft",
          sampleId,
          packetNo: plan.packetNo,
          packetCode,
          packetStatus: "CREATED",
          packetQuantity: plan.packetQuantity,
          packetUnit: plan.packetUnit,
          packetType: plan.packetType,
          createdAt: new Date().toISOString(),
        })
          ? "DETAILS_CAPTURED"
          : "CREATED";

        const created = await tx.packet.create({
          data: {
            companyId: sample.companyId,
            jobId: sample.jobId,
            lotId: sample.lotId,
            sampleId: sample.id,
            packetCode,
            packetNo: plan.packetNo,
            packetStatus: status,
            packetQuantity: plan.packetQuantity,
            packetUnit: plan.packetUnit,
            packetType: plan.packetType,
            remarks: plan.remarks,
            createdById: currentUser.id,
          },
        });

        await tx.packetAllocation.create({
          data: {
            packetId: created.id,
            allocationStatus: "BLOCKED",
          },
        });

        await createPacketEvent(tx, {
          packetId: created.id,
          eventType: "PACKET_CREATED",
          performedById: currentUser.id,
          metadata: {
            packetCode,
            packetNo: plan.packetNo,
          },
        });

        createdPackets.push(created);
      }

      await recordAuditLog(tx, {
        jobId: sample.jobId,
        userId: currentUser.id,
        entity: "PACKET",
        action: "PACKETS_GENERATED",
        metadata: {
          sampleId: sample.id,
          lotId: sample.lotId,
          count: createdPackets.length,
          packetCodes: createdPackets.map((packet) => packet.packetCode),
        },
      });

      return fetchPacketsBySample(tx, sample.id);
    });

    return NextResponse.json(packets);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }

    const message = error instanceof Error ? error.message : "Failed to create packet drafts.";
    if (message === "FORBIDDEN") {
      return jsonError("Forbidden", "Cross-company access is not allowed.", 403);
    }
    if (message === "JOB_LOCKED") {
      return jsonError("Forbidden", "This job is LOCKED for audit integrity. No packet changes are allowed.", 403);
    }
    if (message === "SAMPLE_NOT_READY") {
      return jsonError("Validation Error", "Sample is not ready for packeting yet.", 422);
    }
    if (message === "INVALID_PACKET_QUANTITY") {
      return jsonError("Validation Error", "Packet quantity must be positive.", 422);
    }
    if (message === "PACKET_UNIT_REQUIRED") {
      return jsonError("Validation Error", "Packet unit is required when quantity is entered.", 422);
    }
    if (message.startsWith("PACKET_QUANTITY_EXCEEDED:")) {
      const [, projectedRaw = "", sampleRaw = ""] = message.split(":");
      const projected = projectedRaw.trim();
      const sample = sampleRaw.trim();
      return jsonError(
        "Validation Error",
        projected && sample
          ? `Projected packet total ${projected} exceeds sample quantity ${sample}.`
          : "Total packet quantity exceeds sample quantity.",
        422,
      );
    }
    if (error && typeof error === "object" && "code" in error && String((error as { code?: unknown }).code) === "P2002") {
      return jsonError("Conflict Action", "A packet identity conflict occurred. Please try again.", 409);
    }
    return jsonError("System Error", message, 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "MANAGE_PACKET_WORKFLOW");

    const body = await request.json();
    const packetId = typeof body?.packetId === "string" ? body.packetId.trim() : "";
    if (!packetId) {
      return jsonError("Validation Error", "packetId is required.", 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const workflowPolicy = await getWorkflowPolicy(tx, currentUser.companyId);
      const currentPacket = await getPacketScope(tx, packetId, currentUser.companyId);
      const previous = currentPacket as unknown as PacketRecord;

      const packetQuantity = body?.packetQuantity !== undefined ? normalizeNumber(body.packetQuantity) : undefined;
      const packetWeight = body?.packetWeight !== undefined ? normalizeNumber(body.packetWeight) : undefined;
      const packetUnit = body?.packetUnit !== undefined ? normalizeText(body.packetUnit) : undefined;
      const packetType = body?.packetType !== undefined ? normalizeText(body.packetType) : undefined;
      const remarks = body?.remarks !== undefined ? normalizeText(body.remarks) : undefined;
      const sealNo = body?.sealNo !== undefined ? normalizeText(body.sealNo) : undefined;
      const labelText = body?.labelText !== undefined ? normalizeText(body.labelText) : undefined;
      const labelCode = body?.labelCode !== undefined ? normalizeText(body.labelCode) : undefined;
      const allocationStatus = body?.allocationStatus !== undefined ? normalizeText(body.allocationStatus) : undefined;
      const allocatedToType = body?.allocatedToType !== undefined ? normalizeText(body.allocatedToType) : undefined;
      const allocatedToId = body?.allocatedToId !== undefined ? normalizeText(body.allocatedToId) : undefined;
      const handedOverToRndTo = body?.handedOverToRndTo !== undefined ? normalizeText(body.handedOverToRndTo) : undefined;
      const markLabeled = body?.markLabeled === true;
      const markSealed = body?.markSealed === true;
      const markAvailable = body?.markAvailable === true;
      const markSubmittedToRnd = body?.markSubmittedToRnd === true;

      if (workflowPolicy.workflow.lockPacketEditingAfterRndSubmit && currentPacket.submittedToRndAt && !markSubmittedToRnd) {
        throw new Error("PACKET_LOCKED_AFTER_RND_SUBMIT");
      }

      if (packetQuantity !== undefined && packetQuantity !== null && packetQuantity <= 0) {
        throw new Error("INVALID_PACKET_QUANTITY");
      }
      if (packetWeight !== undefined && packetWeight !== null && packetWeight <= 0) {
        throw new Error("INVALID_PACKET_QUANTITY");
      }

      const nextQuantity =
        packetWeight !== undefined ? packetWeight : packetQuantity !== undefined ? packetQuantity : currentPacket.packetQuantity;
      const nextUnit = packetUnit !== undefined ? packetUnit : currentPacket.packetUnit;
      if (nextQuantity !== null && nextQuantity !== undefined && !nextUnit) {
        throw new Error("PACKET_UNIT_REQUIRED");
      }
      if (workflowPolicy.packet.packetWeightRequired && markSubmittedToRnd && (!nextQuantity || !nextUnit)) {
        throw new Error("PACKET_WEIGHT_REQUIRED");
      }
      if (markSubmittedToRnd && !handedOverToRndTo) {
        throw new Error("RND_HANDOVER_TARGET_REQUIRED");
      }
      if (markSubmittedToRnd && handedOverToRndTo) {
        const rndAssignee = await tx.user.findFirst({
          where: {
            id: handedOverToRndTo,
            companyId: currentUser.companyId,
            role: "RND",
            isActive: true,
          },
          select: { id: true },
        });
        if (!rndAssignee) {
          throw new Error("INVALID_RND_HANDOVER_TARGET");
        }
      }

      const siblingPackets = currentPacket.sample.packets
        .filter((packet) => packet.id !== currentPacket.id)
        .map((packet) => ({ ...packet, allocation: packet.allocation ?? null })) as unknown as PacketRecord[];
      const sampleComparable = toComparableQuantity(currentPacket.sample.sampleQuantity, currentPacket.sample.sampleUnit);
      const nextComparable = toComparableQuantity(nextQuantity, nextUnit);
      if (sampleComparable && nextComparable && sampleComparable.dimension === nextComparable.dimension) {
        const projectedQuantity =
          siblingPackets.reduce((total, packet) => {
            const comparable = toComparableQuantity(packet.packetWeight ?? packet.packetQuantity, packet.packetUnit);
            if (!comparable || comparable.dimension !== sampleComparable.dimension) {
              return total;
            }
            return total + comparable.value;
          }, 0) + nextComparable.value;

        if (projectedQuantity > sampleComparable.value) {
          throw new Error(
            `PACKET_QUANTITY_EXCEEDED:${projectedQuantity} ${sampleComparable.unit}:${sampleComparable.value} ${sampleComparable.unit}`,
          );
        }
      }

      const updateData: Prisma.PacketUpdateInput = {
        ...(packetQuantity !== undefined ? { packetQuantity } : {}),
        ...(packetWeight !== undefined ? { packetWeight } : {}),
        ...(packetUnit !== undefined ? { packetUnit } : {}),
        ...(packetType !== undefined ? { packetType } : {}),
        ...(remarks !== undefined ? { remarks } : {}),
        ...(markSubmittedToRnd
          ? {
              submittedToRndAt: new Date(),
              submittedToRndBy: currentUser.id,
            }
          : {}),
      };

      if (Object.keys(updateData).length > 0) {
        await tx.packet.update({
          where: { id: currentPacket.id },
          data: updateData,
        });
      }

      if (Array.isArray(body?.mediaEntries)) {
        for (const entry of body.mediaEntries as Array<Record<string, unknown>>) {
          const mediaType = normalizePacketMediaType(entry?.mediaType);
          const fileUrl = normalizeText(entry?.fileUrl);
          const mediaRemarks = normalizeText(entry?.remarks);

          if (!mediaType || !fileUrl) {
            continue;
          }

          const existing = await tx.packetMedia.findFirst({
            where: { packetId: currentPacket.id, mediaType },
            orderBy: { capturedAt: "desc" },
          });

          if (existing) {
            await tx.packetMedia.update({
              where: { id: existing.id },
              data: {
                fileUrl,
                remarks: mediaRemarks,
                capturedAt: new Date(),
                capturedById: currentUser.id,
              },
            });
          } else {
            await tx.packetMedia.create({
              data: {
                packetId: currentPacket.id,
                mediaType,
                fileUrl,
                remarks: mediaRemarks,
                capturedById: currentUser.id,
              },
            });
          }

          await recordAuditLog(tx, {
            jobId: currentPacket.jobId,
            userId: currentUser.id,
            entity: "PACKET",
            action: "PACKET_MEDIA_UPLOADED",
            metadata: {
              packetId: currentPacket.id,
              mediaType,
            },
          });
        }
      }

      if (sealNo !== undefined || labelText !== undefined || labelCode !== undefined || markLabeled || markSealed) {
        await tx.packetSealLabel.upsert({
          where: { packetId: currentPacket.id },
          update: {
            ...(sealNo !== undefined ? { sealNo } : {}),
            ...(labelText !== undefined ? { labelText } : {}),
            ...(labelCode !== undefined ? { labelCode } : {}),
            ...(markSealed ? { sealedAt: currentPacket.sealLabel?.sealedAt ?? new Date() } : {}),
            ...(markLabeled ? { labeledAt: currentPacket.sealLabel?.labeledAt ?? new Date() } : {}),
            ...(markSealed || markLabeled ? { sealStatus: "COMPLETED" } : {}),
          },
          create: {
            packetId: currentPacket.id,
            sealNo: sealNo ?? null,
            labelText: labelText ?? null,
            labelCode: labelCode ?? currentPacket.packetCode,
            sealedAt: markSealed ? new Date() : null,
            labeledAt: markLabeled ? new Date() : null,
            sealStatus: markSealed || markLabeled ? "COMPLETED" : "PENDING",
          },
        });
      }

      let refreshed = (await tx.packet.findUnique({
        where: { id: currentPacket.id },
        include: packetInclude,
      })) as PacketRecord | null;

      if (!refreshed) {
        throw new Error("PACKET_NOT_FOUND");
      }

      const readiness = getPacketReadiness(refreshed);
      let nextStatus = derivePacketStatus(refreshed);
      let nextAllocationStatus = currentPacket.allocation?.allocationStatus ?? "BLOCKED";
      let nextAllocatedToType = currentPacket.allocation?.allocatedToType ?? null;
      let nextAllocatedToId = currentPacket.allocation?.allocatedToId ?? null;
      let nextAllocatedAt = currentPacket.allocation?.allocatedAt ?? null;
      let readyAt = refreshed.readyAt ? new Date(refreshed.readyAt) : null;

      if (markAvailable) {
        if (!readiness.isReady) {
          throw new Error(`READINESS_BLOCKED:${readiness.missing.join(" | ")}`);
        }
        nextStatus = "AVAILABLE";
        nextAllocationStatus = "AVAILABLE";
        nextAllocatedToType = null;
        nextAllocatedToId = null;
        nextAllocatedAt = null;
        readyAt = readyAt ?? new Date();
      }

      if (allocationStatus) {
        if (!["AVAILABLE", "RESERVED", "ALLOCATED", "USED", "BLOCKED"].includes(allocationStatus)) {
          throw new Error("INVALID_ALLOCATION_STATUS");
        }

        if (allocationStatus !== "BLOCKED" && allocationStatus !== "USED" && !readiness.isReady) {
          throw new Error(`READINESS_BLOCKED:${readiness.missing.join(" | ")}`);
        }

        nextAllocationStatus = allocationStatus;
        nextAllocatedToType = allocationStatus === "AVAILABLE" || allocationStatus === "BLOCKED" ? null : allocatedToType ?? null;
        nextAllocatedToId = allocationStatus === "AVAILABLE" || allocationStatus === "BLOCKED" ? null : allocatedToId ?? null;
        nextAllocatedAt =
          allocationStatus === "AVAILABLE" || allocationStatus === "BLOCKED"
            ? null
            : currentPacket.allocation?.allocatedAt ?? new Date();
        nextStatus = allocationStatus as PacketStatus;
      }

      await tx.packetAllocation.upsert({
        where: { packetId: currentPacket.id },
        update: {
          allocationStatus: nextAllocationStatus,
          allocatedToType: nextAllocatedToType,
          allocatedToId: nextAllocatedToId,
          allocatedAt: nextAllocatedAt,
        },
        create: {
          packetId: currentPacket.id,
          allocationStatus: nextAllocationStatus,
          allocatedToType: nextAllocatedToType,
          allocatedToId: nextAllocatedToId,
          allocatedAt: nextAllocatedAt,
        },
      });

      await tx.packet.update({
        where: { id: currentPacket.id },
        data: {
          packetStatus: nextStatus,
          readyAt: nextStatus === "AVAILABLE" ? readyAt : nextStatus === "BLOCKED" ? null : readyAt,
        },
      });

      refreshed = (await tx.packet.findUnique({
        where: { id: currentPacket.id },
        include: packetInclude,
      })) as PacketRecord | null;

      if (!refreshed) {
        throw new Error("PACKET_NOT_FOUND");
      }

      const detailsBefore = hasPacketDetails(previous);
      const detailsNow = hasPacketDetails(refreshed);
      const sealAndLabelBefore = hasPacketSealAndLabel(previous.sealLabel);
      const sealAndLabelNow = hasPacketSealAndLabel(refreshed.sealLabel);

      if (!detailsBefore && detailsNow) {
        await recordAuditLog(tx, {
          jobId: refreshed.jobId ?? currentPacket.jobId,
          userId: currentUser.id,
          entity: "PACKET",
          action: "PACKET_QUANTITY_UPDATED",
          metadata: {
            packetId: refreshed.id,
            packetQuantity: refreshed.packetQuantity,
            packetUnit: refreshed.packetUnit,
          },
        });
      }

      if (markSubmittedToRnd) {
        await createPacketEvent(tx, {
          packetId: refreshed.id,
          eventType: "PACKET_SUBMITTED_TO_RND",
          performedById: currentUser.id,
        });
        await recordAuditLog(tx, {
          jobId: refreshed.jobId ?? currentPacket.jobId,
          userId: currentUser.id,
          entity: "PACKET",
          action: "PACKET_SUBMITTED_TO_RND",
          metadata: {
            packetId: refreshed.id,
            submittedToRndAt: refreshed.submittedToRndAt,
          },
        });
      }

      await recomputeJobWorkflowMilestones(tx, {
        jobId: refreshed.jobId ?? currentPacket.jobId,
        companyId: currentUser.companyId,
        handedOverToRndTo: markSubmittedToRnd ? handedOverToRndTo ?? null : undefined,
      });

      if (packetType !== undefined && packetType !== previous.packetType) {
        await recordAuditLog(tx, {
          jobId: refreshed.jobId ?? currentPacket.jobId,
          userId: currentUser.id,
          entity: "PACKET",
          action: "PACKET_TYPE_UPDATED",
          metadata: {
            packetId: refreshed.id,
            packetType: refreshed.packetType,
          },
        });
      }

      if (!previous.sealLabel?.labeledAt && refreshed.sealLabel?.labeledAt) {
        await createPacketEvent(tx, {
          packetId: refreshed.id,
          eventType: "PACKET_LABELED",
          performedById: currentUser.id,
        });
        await recordAuditLog(tx, {
          jobId: refreshed.jobId ?? currentPacket.jobId,
          userId: currentUser.id,
          entity: "PACKET",
          action: "PACKET_LABEL_SAVED",
          metadata: {
            packetId: refreshed.id,
            labelCode: refreshed.sealLabel?.labelCode,
          },
        });
      }

      if (!previous.sealLabel?.sealedAt && refreshed.sealLabel?.sealedAt) {
        await createPacketEvent(tx, {
          packetId: refreshed.id,
          eventType: "PACKET_SEALED",
          performedById: currentUser.id,
        });
        await recordAuditLog(tx, {
          jobId: refreshed.jobId ?? currentPacket.jobId,
          userId: currentUser.id,
          entity: "PACKET",
          action: "PACKET_SEAL_SAVED",
          metadata: {
            packetId: refreshed.id,
            sealNo: refreshed.sealLabel?.sealNo,
          },
        });
      }

      if (!sealAndLabelBefore && sealAndLabelNow && nextStatus === "SEALED") {
        await createPacketEvent(tx, {
          packetId: refreshed.id,
          eventType: "PACKET_VERIFIED",
          performedById: currentUser.id,
          remarks: "Seal and label requirements completed.",
        });
      }

      if (markAvailable && refreshed.packetStatus === "AVAILABLE") {
        await createPacketEvent(tx, {
          packetId: refreshed.id,
          eventType: "PACKET_RELEASED",
          performedById: currentUser.id,
        });
        await recordAuditLog(tx, {
          jobId: refreshed.jobId ?? currentPacket.jobId,
          userId: currentUser.id,
          entity: "PACKET",
          action: "PACKET_MARKED_AVAILABLE",
          to: "AVAILABLE",
          metadata: {
            packetId: refreshed.id,
            readinessMissing: [],
          },
        });
      }

      if (allocationStatus === "ALLOCATED") {
        await createPacketEvent(tx, {
          packetId: refreshed.id,
          eventType: "PACKET_ASSIGNED_TO_TRIAL",
          performedById: currentUser.id,
          metadata: {
            allocatedToType: nextAllocatedToType,
            allocatedToId: nextAllocatedToId,
          },
        });
        await recordAuditLog(tx, {
          jobId: refreshed.jobId ?? currentPacket.jobId,
          userId: currentUser.id,
          entity: "PACKET",
          action: "PACKET_ALLOCATED",
          to: "ALLOCATED",
          metadata: {
            packetId: refreshed.id,
            allocatedToId: nextAllocatedToId,
          },
        });
      }

      if (allocationStatus === "RESERVED") {
        await recordAuditLog(tx, {
          jobId: refreshed.jobId ?? currentPacket.jobId,
          userId: currentUser.id,
          entity: "PACKET",
          action: "PACKET_RESERVED",
          to: "RESERVED",
          metadata: {
            packetId: refreshed.id,
            allocatedToId: nextAllocatedToId,
          },
        });
      }

      if (allocationStatus === "USED") {
        await createPacketEvent(tx, {
          packetId: refreshed.id,
          eventType: "PACKET_MARKED_USED",
          performedById: currentUser.id,
        });
        await recordAuditLog(tx, {
          jobId: refreshed.jobId ?? currentPacket.jobId,
          userId: currentUser.id,
          entity: "PACKET",
          action: "PACKET_MARKED_USED",
          to: "USED",
          metadata: {
            packetId: refreshed.id,
          },
        });
      }

      return refreshed;
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }

    const message = error instanceof Error ? error.message : "Failed to update packet.";
    if (message === "FORBIDDEN") {
      return jsonError("Forbidden", "Cross-company access is not allowed.", 403);
    }
    if (message === "JOB_LOCKED") {
      return jsonError("Forbidden", "This job is LOCKED for audit integrity. No packet changes are allowed.", 403);
    }
    if (message === "PACKET_NOT_FOUND") {
      return jsonError("Not Found", "Packet not found.", 404);
    }
    if (message === "INVALID_PACKET_QUANTITY") {
      return jsonError("Validation Error", "Packet quantity must be positive.", 422);
    }
    if (message === "PACKET_UNIT_REQUIRED") {
      return jsonError("Validation Error", "Packet unit is mandatory when quantity is provided.", 422);
    }
    if (message === "PACKET_WEIGHT_REQUIRED") {
      return jsonError("Validation Error", "Every packet needs weight and unit before Submit to R&D.", 422);
    }
    if (message === "RND_HANDOVER_TARGET_REQUIRED") {
      return jsonError("Validation Error", "Select an R&D user before Submit to R&D.", 422);
    }
    if (message === "INVALID_RND_HANDOVER_TARGET") {
      return jsonError("Validation Error", "Selected R&D handover user is not valid for this company.", 422);
    }
    if (message === "PACKET_LOCKED_AFTER_RND_SUBMIT") {
      return jsonError("Forbidden", "Packet editing is locked after Submit to R&D by company policy.", 403);
    }
    if (message === "INVALID_ALLOCATION_STATUS") {
      return jsonError("Validation Error", "Invalid packet allocation status.", 422);
    }
    if (message.startsWith("PACKET_QUANTITY_EXCEEDED:")) {
      const [, projectedRaw = "", sampleRaw = ""] = message.split(":");
      const projected = projectedRaw.trim();
      const sample = sampleRaw.trim();
      return jsonError(
        "Validation Error",
        projected && sample
          ? `Packet total ${projected} exceeds allowed sample quantity ${sample}. Reduce packet weights or increase sample quantity first.`
          : "Total packet quantity exceeds sample quantity.",
        422,
      );
    }
    if (message.startsWith("READINESS_BLOCKED:")) {
      return jsonError("Validation Error", message.replace("READINESS_BLOCKED:", ""), 422);
    }
    return jsonError("System Error", message, 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "MANAGE_PACKET_WORKFLOW");

    const body = await request.json();
    const packetId = typeof body?.packetId === "string" ? body.packetId.trim() : "";
    if (!packetId) {
      return jsonError("Validation Error", "packetId is required.", 400);
    }

    await prisma.$transaction(async (tx) => {
      const packet = await getPacketScope(tx, packetId, currentUser.companyId);
      const allocationStatus = packet.allocation?.allocationStatus ?? "BLOCKED";

      if (allocationStatus === "RESERVED" || allocationStatus === "ALLOCATED" || allocationStatus === "USED") {
        throw new Error("PACKET_DELETE_BLOCKED");
      }

      await tx.packet.delete({
        where: { id: packet.id },
      });

      await recordAuditLog(tx, {
        jobId: packet.jobId,
        userId: currentUser.id,
        entity: "PACKET",
        action: "PACKET_DELETED",
        metadata: {
          packetId: packet.id,
          packetCode: packet.packetCode,
          sampleId: packet.sampleId,
          lotId: packet.lotId,
        },
      });
    });

    return NextResponse.json({ success: true, packetId });
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }

    const message = error instanceof Error ? error.message : "Failed to delete packet.";
    if (message === "FORBIDDEN") {
      return jsonError("Forbidden", "Cross-company access is not allowed.", 403);
    }
    if (message === "JOB_LOCKED") {
      return jsonError("Forbidden", "This job is LOCKED for audit integrity. No packet changes are allowed.", 403);
    }
    if (message === "PACKET_DELETE_BLOCKED") {
      return jsonError("Validation Error", "Reserved, allocated, or used packets cannot be deleted.", 422);
    }
    return jsonError("System Error", message, 500);
  }
}
