import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { authorize, AuthorizationError } from "@/lib/rbac";
import { resolveActiveOutputForLineage } from "@/lib/rnd-report-linkage";
import { getCurrentUserFromRequest } from "@/lib/session";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ lotId: string }> };

type TraceabilityLotResponse = {
  lot: {
    id: string;
    lotNumber: string;
    materialName: string | null;
    currentStep: string;
    status: string;
    jobId: string;
    jobNumber: string;
    jobReferenceNumber: string;
    clientName: string;
    createdAt: string;
    updatedAt: string;
  };
  inspection: Array<{
    id: string;
    status: string;
    decision: string;
    startedAt: string;
    completedAt: string | null;
    issueCount: number;
  }>;
  samples: Array<{
    id: string;
    sampleCode: string;
    status: string;
    sampleType: string | null;
    samplingDate: string | null;
    remarks: string | null;
  }>;
  rdTests: Array<{
    id: string;
    trialNumber: number;
    createdAt: string;
    notes: string | null;
    measurementCount: number;
  }>;
  packets: Array<{
    id: string;
    packetCode: string;
    packetNo: number;
    status: string;
    quantity: number | null;
    unit: string | null;
    readyAt: string | null;
    allocationStatus: string | null;
  }>;
  dispatches: Array<{
    id: string;
    packetCode: string;
    dispatchState: string;
    blockingReason: string | null;
    currentForDispatchSnapshotId: string | null;
    currentForDispatchUrl: string | null;
  }>;
  coa: {
    available: boolean;
    latestSnapshotId: string | null;
    previousSnapshotIds: string[];
    generatedAt: string | null;
  };
  reports: {
    active: {
      snapshotId: string | null;
      rndJobNumber: string | null;
      generatedAt: string | null;
      status: "Active Report" | "Available";
    };
    previous: Array<{
      snapshotId: string;
      rndJobNumber: string;
      generatedAt: string | null;
      status: "Previous Report";
    }>;
  };
  relatedDocuments: Array<{
    id: string;
    type: string;
    label: string;
    status: string;
    createdAt: string;
    url: string | null;
  }>;
  auditTimeline: Array<{
    id: string;
    action: string;
    entity: string;
    at: string;
    by: string;
    note: string | null;
  }>;
};

function jsonError(error: string, details: string, status: number) {
  return NextResponse.json({ error, details }, { status });
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function buildUserLabel(input: { profile?: { displayName?: string | null } | null } | null | undefined): string {
  return input?.profile?.displayName?.trim() || "System";
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "READ_ONLY");

    const { lotId } = await context.params;
    if (!lotId?.trim()) {
      return jsonError("Validation Error", "lotId is required.", 400);
    }

    const lot = await prisma.inspectionLot.findUnique({
      where: { id: lotId },
      select: {
        id: true,
        companyId: true,
        lotNumber: true,
        materialName: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        job: {
          select: {
            id: true,
            inspectionSerialNumber: true,
            jobReferenceNumber: true,
            clientName: true,
            status: true,
            reportSnapshots: {
              orderBy: { createdAt: "desc" },
              select: { id: true, createdAt: true },
            },
          },
        },
        mediaFiles: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            category: true,
            fileName: true,
            storageKey: true,
            createdAt: true,
          },
        },
        inspection: {
          select: {
            id: true,
            inspectionStatus: true,
            decisionStatus: true,
            startedAt: true,
            completedAt: true,
            issueCount: true,
            mediaFiles: {
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                category: true,
                fileName: true,
                storageKey: true,
                createdAt: true,
              },
            },
          },
        },
        sample: {
          select: {
            id: true,
            sampleCode: true,
            sampleStatus: true,
            sampleType: true,
            samplingDate: true,
            remarks: true,
            media: {
              orderBy: { capturedAt: "desc" },
              select: {
                id: true,
                mediaType: true,
                fileUrl: true,
                capturedAt: true,
              },
            },
            packets: {
              orderBy: { packetNo: "asc" },
              select: {
                id: true,
                packetCode: true,
                packetNo: true,
                packetStatus: true,
                packetQuantity: true,
                packetUnit: true,
                readyAt: true,
                media: {
                  orderBy: { capturedAt: "desc" },
                  select: {
                    id: true,
                    mediaType: true,
                    fileUrl: true,
                    capturedAt: true,
                  },
                },
                allocation: {
                  select: {
                    allocationStatus: true,
                    allocatedAt: true,
                  },
                },
                trial: {
                  select: {
                    id: true,
                    trialNumber: true,
                    notes: true,
                    createdAt: true,
                    measurements: {
                      select: { id: true },
                    },
                  },
                },
              },
            },
          },
        },
        trials: {
          orderBy: [{ createdAt: "asc" }, { trialNumber: "asc" }],
          select: {
            id: true,
            trialNumber: true,
            notes: true,
            createdAt: true,
            measurements: {
              select: { id: true },
            },
          },
        },
      },
    });

    if (!lot) {
      return jsonError("Not Found", "Lot not found.", 404);
    }

    if (lot.companyId !== currentUser.companyId) {
      return jsonError("Forbidden", "Cross-company access is not allowed.", 403);
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: { jobId: lot.job.id },
      orderBy: { createdAt: "desc" },
      take: 150,
      select: {
        id: true,
        action: true,
        entity: true,
        notes: true,
        metadata: true,
        createdAt: true,
        user: {
          select: {
            profile: {
              select: {
                displayName: true,
              },
            },
          },
        },
      },
    });

    const lotScopedAudit = auditLogs.filter((entry) => {
      const metadata = entry.metadata;
      if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
        return entry.entity === "JOB";
      }
      const metaLotId = (metadata as Record<string, unknown>).lotId;
      return typeof metaLotId !== "string" || metaLotId === lot.id;
    });

    const packetTrialsRaw = lot.sample?.packets.map((packet) => packet.trial) ?? [];
    const packetTrials = packetTrialsRaw.filter(
      (trial): trial is NonNullable<(typeof packetTrialsRaw)[number]> => Boolean(trial)
    );

    const trialMap = new Map<string, {
      id: string;
      trialNumber: number;
      createdAt: string;
      notes: string | null;
      measurementCount: number;
    }>();

    for (const trial of [...lot.trials, ...packetTrials]) {
      trialMap.set(trial.id, {
        id: trial.id,
        trialNumber: trial.trialNumber,
        createdAt: trial.createdAt.toISOString(),
        notes: trial.notes ?? null,
        measurementCount: trial.measurements.length,
      });
    }

    const relatedDocuments: TraceabilityLotResponse["relatedDocuments"] = [];
    const outputSelection = lot.sample
      ? await resolveActiveOutputForLineage(prisma, {
          companyId: currentUser.companyId,
          parentJobId: lot.job.id,
          sampleId: lot.sample.id,
          fallbackSnapshots: lot.job.reportSnapshots,
        })
      : null;
    const activeSnapshotId = outputSelection?.activeReport?.snapshotId ?? null;
    const currentForDispatchUrl = outputSelection?.currentForDispatch?.url ?? null;
    const previousSnapshotIds = (outputSelection?.previousReports ?? []).map((row) => row.snapshotId);
    const precedenceBySnapshot = new Map<string, string>();
    if (activeSnapshotId) precedenceBySnapshot.set(activeSnapshotId, "Active Report");
    for (const id of previousSnapshotIds) {
      precedenceBySnapshot.set(id, "Superseded");
    }

    for (const snapshot of lot.job.reportSnapshots) {
      const precedence = precedenceBySnapshot.get(snapshot.id);
      relatedDocuments.push({
        id: `report-${snapshot.id}`,
        type: "Test Report",
        label: `Report Snapshot ${snapshot.id.slice(0, 8)}`,
        status: precedence ?? "Available",
        createdAt: snapshot.createdAt.toISOString(),
        url: `/api/report/${snapshot.id}`,
      });
    }

    for (const media of lot.mediaFiles) {
      relatedDocuments.push({
        id: `lot-media-${media.id}`,
        type: "Inspection Upload",
        label: media.fileName || media.category,
        status: "Available",
        createdAt: media.createdAt.toISOString(),
        url: media.storageKey,
      });
    }

    for (const media of lot.inspection?.mediaFiles ?? []) {
      relatedDocuments.push({
        id: `inspection-media-${media.id}`,
        type: "Inspection Upload",
        label: media.fileName || media.category,
        status: "Available",
        createdAt: media.createdAt.toISOString(),
        url: media.storageKey,
      });
    }

    for (const media of lot.sample?.media ?? []) {
      relatedDocuments.push({
        id: `sample-media-${media.id}`,
        type: "Test Report",
        label: media.mediaType,
        status: "Available",
        createdAt: media.capturedAt.toISOString(),
        url: media.fileUrl,
      });
    }

    for (const packet of lot.sample?.packets ?? []) {
      for (const media of packet.media) {
        relatedDocuments.push({
          id: `packet-media-${media.id}`,
          type: "Packet Document",
          label: `${packet.packetCode} - ${media.mediaType}`,
          status: "Available",
          createdAt: media.capturedAt.toISOString(),
          url: media.fileUrl,
        });
      }
    }

    const response: TraceabilityLotResponse = {
      lot: {
        id: lot.id,
        lotNumber: lot.lotNumber,
        materialName: lot.materialName ?? null,
        currentStep: lot.job.status,
        status: lot.status,
        jobId: lot.job.id,
        jobNumber: lot.job.inspectionSerialNumber,
        jobReferenceNumber: lot.job.jobReferenceNumber,
        clientName: lot.job.clientName,
        createdAt: lot.createdAt.toISOString(),
        updatedAt: lot.updatedAt.toISOString(),
      },
      inspection: lot.inspection
        ? [{
            id: lot.inspection.id,
            status: lot.inspection.inspectionStatus,
            decision: lot.inspection.decisionStatus,
            startedAt: lot.inspection.startedAt.toISOString(),
            completedAt: toIso(lot.inspection.completedAt),
            issueCount: lot.inspection.issueCount,
          }]
        : [],
      samples: lot.sample
        ? [{
            id: lot.sample.id,
            sampleCode: lot.sample.sampleCode,
            status: lot.sample.sampleStatus,
            sampleType: lot.sample.sampleType ?? null,
            samplingDate: toIso(lot.sample.samplingDate),
            remarks: lot.sample.remarks ?? null,
          }]
        : [],
      rdTests: [...trialMap.values()].sort((left, right) => left.trialNumber - right.trialNumber),
      packets: (lot.sample?.packets ?? []).map((packet) => ({
        id: packet.id,
        packetCode: packet.packetCode,
        packetNo: packet.packetNo,
        status: packet.packetStatus,
        quantity: packet.packetQuantity ?? null,
        unit: packet.packetUnit ?? null,
        readyAt: toIso(packet.readyAt),
        allocationStatus: packet.allocation?.allocationStatus ?? null,
      })),
      dispatches: (lot.sample?.packets ?? []).map((packet) => {
        const allocationStatus = packet.allocation?.allocationStatus ?? "BLOCKED";
        const hasCoa = Boolean(activeSnapshotId);
        const blocked = !hasCoa
          ? "COA is not available for this lot."
          : allocationStatus === "BLOCKED"
            ? "Packet allocation is blocked."
            : null;
        return {
          id: `dispatch-${packet.id}`,
          packetCode: packet.packetCode,
          dispatchState: allocationStatus,
          blockingReason: blocked,
          currentForDispatchSnapshotId: activeSnapshotId,
          currentForDispatchUrl,
        };
      }),
      coa: {
        available: Boolean(activeSnapshotId),
        latestSnapshotId: activeSnapshotId,
        previousSnapshotIds,
        generatedAt: outputSelection?.activeCoa?.generatedAt ?? null,
      },
      reports: {
        active: {
          snapshotId: activeSnapshotId,
          rndJobNumber: outputSelection?.activeReport?.rndJobNumber ?? null,
          generatedAt: outputSelection?.activeReport?.generatedAt ?? null,
          status: outputSelection?.selectionSource === "LINEAGE" ? "Active Report" : "Available",
        },
        previous: (outputSelection?.previousReports ?? []).map((row) => ({
          snapshotId: row.snapshotId,
          rndJobNumber: row.rndJobNumber,
          generatedAt: row.generatedAt,
          status: row.status,
        })),
      },
      relatedDocuments: relatedDocuments
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, 200),
      auditTimeline: lotScopedAudit.map((entry) => ({
        id: entry.id,
        action: entry.action,
        entity: entry.entity,
        at: entry.createdAt.toISOString(),
        by: buildUserLabel(entry.user),
        note: entry.notes ?? null,
      })),
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }

    const message = error instanceof Error ? error.message : "Failed to fetch lot traceability.";
    return jsonError("System Error", message, 500);
  }
}
