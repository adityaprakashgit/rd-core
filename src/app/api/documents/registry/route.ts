import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { authorize, AuthorizationError } from "@/lib/rbac";
import { resolveActiveOutputForLineage } from "@/lib/rnd-report-linkage";
import { getCurrentUserFromRequest } from "@/lib/session";

export const dynamic = "force-dynamic";

type DocumentTypeKey =
  | "COA"
  | "DISPATCH_DOCUMENT"
  | "TEST_REPORT"
  | "INSPECTION_UPLOAD"
  | "PACKET_DOCUMENT";

type DocumentRegistryFilters = {
  lot?: string;
  packet?: string;
  job?: string;
  dateFrom?: string;
  dateTo?: string;
  documentType?: string;
  status?: string;
};

type DocumentRegistryRow = {
  id: string;
  documentType: DocumentTypeKey;
  documentLabel: string;
  jobId: string;
  jobNumber: string;
  lotId: string | null;
  lotNumber: string | null;
  packetId: string | null;
  packetCode: string | null;
  status: string;
  generatedAt: string;
  linkedActionUrl: string | null;
  source: "REPORT_SNAPSHOT" | "MEDIA_FILE" | "SAMPLE_MEDIA" | "PACKET_MEDIA";
};

function jsonError(error: string, details: string, status: number) {
  return NextResponse.json({ error, details }, { status });
}

function normalizeFilter(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function parseFilters(request: NextRequest): DocumentRegistryFilters {
  return {
    lot: normalizeFilter(request.nextUrl.searchParams.get("lot")) ?? undefined,
    packet: normalizeFilter(request.nextUrl.searchParams.get("packet")) ?? undefined,
    job: normalizeFilter(request.nextUrl.searchParams.get("job")) ?? undefined,
    dateFrom: normalizeFilter(request.nextUrl.searchParams.get("dateFrom")) ?? undefined,
    dateTo: normalizeFilter(request.nextUrl.searchParams.get("dateTo")) ?? undefined,
    documentType: normalizeFilter(request.nextUrl.searchParams.get("documentType")) ?? undefined,
    status: normalizeFilter(request.nextUrl.searchParams.get("status")) ?? undefined,
  };
}

function withinDateRange(value: Date, dateFrom?: string, dateTo?: string): boolean {
  if (dateFrom) {
    const from = new Date(dateFrom);
    if (!Number.isNaN(from.getTime()) && value < from) {
      return false;
    }
  }
  if (dateTo) {
    const to = new Date(dateTo);
    if (!Number.isNaN(to.getTime()) && value > to) {
      return false;
    }
  }
  return true;
}

function mapMatches(rowValue: string | null | undefined, filterValue?: string): boolean {
  if (!filterValue) {
    return true;
  }
  if (!rowValue) {
    return false;
  }
  return rowValue.toLowerCase().includes(filterValue.toLowerCase());
}

function documentTypeLabel(type: DocumentTypeKey): string {
  switch (type) {
    case "COA":
      return "COA";
    case "DISPATCH_DOCUMENT":
      return "Dispatch Document";
    case "TEST_REPORT":
      return "Test Report";
    case "INSPECTION_UPLOAD":
      return "Inspection Upload";
    case "PACKET_DOCUMENT":
      return "Packet Document";
    default:
      return "Document";
  }
}

function buildDocumentRows(input: {
  jobs: Array<{
    id: string;
    inspectionSerialNumber: string;
    jobReferenceNumber: string;
    status: string;
    reportSnapshots: Array<{ id: string; createdAt: Date }>;
    lots: Array<{
      id: string;
      lotNumber: string;
      mediaFiles: Array<{ id: string; fileName: string; storageKey: string; createdAt: Date }>;
      inspection: {
        mediaFiles: Array<{ id: string; fileName: string; storageKey: string; createdAt: Date }>;
      } | null;
      sample: {
        id: string;
        media: Array<{ id: string; mediaType: string; fileUrl: string; capturedAt: Date }>;
        packets: Array<{
          id: string;
          packetCode: string;
          media: Array<{ id: string; mediaType: string; fileUrl: string; capturedAt: Date }>;
          allocation: { allocationStatus: string } | null;
        }>;
      } | null;
    }>;
  }>;
  activeOutputBySampleId: Map<string, { snapshotId: string; url: string; source: "LINEAGE" | "LEGACY_FALLBACK" }>;
  reportStatusBySnapshotId: Map<string, string>;
  coaStatusBySnapshotId: Map<string, string>;
}): DocumentRegistryRow[] {
  const rows: DocumentRegistryRow[] = [];

  for (const job of input.jobs) {
    const jobNumber = job.inspectionSerialNumber || job.jobReferenceNumber;

    for (const snapshot of job.reportSnapshots) {
      const reportStatus = input.reportStatusBySnapshotId.get(snapshot.id) ?? "Available";
      const coaStatus = input.coaStatusBySnapshotId.get(snapshot.id) ?? "Available";
      rows.push({
        id: `report-${snapshot.id}`,
        documentType: "TEST_REPORT",
        documentLabel: documentTypeLabel("TEST_REPORT"),
        jobId: job.id,
        jobNumber,
        lotId: null,
        lotNumber: null,
        packetId: null,
        packetCode: null,
        status: reportStatus,
        generatedAt: snapshot.createdAt.toISOString(),
        linkedActionUrl: `/api/report/${snapshot.id}`,
        source: "REPORT_SNAPSHOT",
      });

      rows.push({
        id: `coa-${snapshot.id}`,
        documentType: "COA",
        documentLabel: documentTypeLabel("COA"),
        jobId: job.id,
        jobNumber,
        lotId: null,
        lotNumber: null,
        packetId: null,
        packetCode: null,
        status: coaStatus,
        generatedAt: snapshot.createdAt.toISOString(),
        linkedActionUrl: `/api/report/${snapshot.id}`,
        source: "REPORT_SNAPSHOT",
      });
    }

    for (const lot of job.lots) {
      for (const media of lot.mediaFiles) {
        rows.push({
          id: `lot-media-${media.id}`,
          documentType: "INSPECTION_UPLOAD",
          documentLabel: documentTypeLabel("INSPECTION_UPLOAD"),
          jobId: job.id,
          jobNumber,
          lotId: lot.id,
          lotNumber: lot.lotNumber,
          packetId: null,
          packetCode: null,
          status: "Available",
          generatedAt: media.createdAt.toISOString(),
          linkedActionUrl: media.storageKey,
          source: "MEDIA_FILE",
        });
      }

      for (const media of lot.inspection?.mediaFiles ?? []) {
        rows.push({
          id: `inspection-media-${media.id}`,
          documentType: "INSPECTION_UPLOAD",
          documentLabel: documentTypeLabel("INSPECTION_UPLOAD"),
          jobId: job.id,
          jobNumber,
          lotId: lot.id,
          lotNumber: lot.lotNumber,
          packetId: null,
          packetCode: null,
          status: "Available",
          generatedAt: media.createdAt.toISOString(),
          linkedActionUrl: media.storageKey,
          source: "MEDIA_FILE",
        });
      }

      for (const media of lot.sample?.media ?? []) {
        rows.push({
          id: `sample-media-${media.id}`,
          documentType: "TEST_REPORT",
          documentLabel: documentTypeLabel("TEST_REPORT"),
          jobId: job.id,
          jobNumber,
          lotId: lot.id,
          lotNumber: lot.lotNumber,
          packetId: null,
          packetCode: null,
          status: "Available",
          generatedAt: media.capturedAt.toISOString(),
          linkedActionUrl: media.fileUrl,
          source: "SAMPLE_MEDIA",
        });
      }

      for (const packet of lot.sample?.packets ?? []) {
        for (const media of packet.media) {
          rows.push({
            id: `packet-media-${media.id}`,
            documentType: "PACKET_DOCUMENT",
            documentLabel: documentTypeLabel("PACKET_DOCUMENT"),
            jobId: job.id,
            jobNumber,
            lotId: lot.id,
            lotNumber: lot.lotNumber,
            packetId: packet.id,
            packetCode: packet.packetCode,
            status: "Available",
            generatedAt: media.capturedAt.toISOString(),
            linkedActionUrl: media.fileUrl,
            source: "PACKET_MEDIA",
          });
        }

        const activeOutput = lot.sample
          ? input.activeOutputBySampleId.get(lot.sample.id) ?? null
          : null;
        const dispatchSnapshotId = activeOutput?.snapshotId ?? null;
        const dispatchSnapshot = dispatchSnapshotId
          ? job.reportSnapshots.find((snapshot) => snapshot.id === dispatchSnapshotId) ?? null
          : null;
        if (packet.allocation?.allocationStatus && dispatchSnapshot && activeOutput) {
          rows.push({
            id: `dispatch-${packet.id}-${dispatchSnapshot.id}`,
            documentType: "DISPATCH_DOCUMENT",
            documentLabel: documentTypeLabel("DISPATCH_DOCUMENT"),
            jobId: job.id,
            jobNumber,
            lotId: lot.id,
            lotNumber: lot.lotNumber,
            packetId: packet.id,
            packetCode: packet.packetCode,
            status: "Current for Dispatch",
            generatedAt: dispatchSnapshot.createdAt.toISOString(),
            linkedActionUrl: activeOutput.url,
            source: "REPORT_SNAPSHOT",
          });
        }
      }
    }
  }

  return rows;
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "READ_ONLY");

    const filters = parseFilters(request);

    const jobs = await prisma.inspectionJob.findMany({
      where: {
        companyId: currentUser.companyId,
        ...(filters.job
          ? {
              OR: [
                { inspectionSerialNumber: { contains: filters.job, mode: "insensitive" } },
                { jobReferenceNumber: { contains: filters.job, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 250,
      select: {
        id: true,
        inspectionSerialNumber: true,
        jobReferenceNumber: true,
        status: true,
        reportSnapshots: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            createdAt: true,
          },
        },
        lots: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            lotNumber: true,
            mediaFiles: {
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                fileName: true,
                storageKey: true,
                createdAt: true,
              },
            },
            inspection: {
              select: {
                mediaFiles: {
                  orderBy: { createdAt: "desc" },
                  select: {
                    id: true,
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
                  orderBy: { createdAt: "desc" },
                  select: {
                    id: true,
                    packetCode: true,
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
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const activeOutputBySampleId = new Map<string, { snapshotId: string; url: string; source: "LINEAGE" | "LEGACY_FALLBACK" }>();
    const reportStatusBySnapshotId = new Map<string, string>();
    const coaStatusBySnapshotId = new Map<string, string>();

    const sampleLineagesMap = new Map<string, { sampleId: string; parentJobId: string; fallbackSnapshots: Array<{ id: string; createdAt: Date }> }>();
    for (const job of jobs) {
      for (const lot of job.lots) {
        const sampleId = lot.sample?.id;
        if (!sampleId || sampleLineagesMap.has(sampleId)) {
          continue;
        }
        sampleLineagesMap.set(sampleId, {
          sampleId,
          parentJobId: job.id,
          fallbackSnapshots: job.reportSnapshots,
        });
      }
    }
    const sampleLineages = [...sampleLineagesMap.values()];

    for (const lineage of sampleLineages) {
      const output = await resolveActiveOutputForLineage(prisma, {
        companyId: currentUser.companyId,
        parentJobId: lineage.parentJobId,
        sampleId: lineage.sampleId,
        fallbackSnapshots: lineage.fallbackSnapshots,
      });

      if (output.currentForDispatch) {
        activeOutputBySampleId.set(lineage.sampleId, {
          snapshotId: output.currentForDispatch.snapshotId,
          url: output.currentForDispatch.url,
          source: output.selectionSource ?? "LEGACY_FALLBACK",
        });
      }

      if (output.selectionSource === "LINEAGE") {
        if (output.activeReport) {
          reportStatusBySnapshotId.set(output.activeReport.snapshotId, "Active Report");
        }
        if (output.activeCoa) {
          coaStatusBySnapshotId.set(output.activeCoa.snapshotId, "Active COA");
        }
        for (const row of output.previousReports) {
          if (!reportStatusBySnapshotId.has(row.snapshotId)) {
            reportStatusBySnapshotId.set(row.snapshotId, row.status);
          }
          if (!coaStatusBySnapshotId.has(row.snapshotId)) {
            coaStatusBySnapshotId.set(row.snapshotId, row.status);
          }
        }
      }
    }

    const rows = buildDocumentRows({
      jobs,
      activeOutputBySampleId,
      reportStatusBySnapshotId,
      coaStatusBySnapshotId,
    })
      .filter((row) => mapMatches(row.lotNumber, filters.lot))
      .filter((row) => mapMatches(row.packetCode, filters.packet))
      .filter((row) => (filters.documentType ? row.documentType === filters.documentType : true))
      .filter((row) => (filters.status ? row.status.toLowerCase() === filters.status.toLowerCase() : true))
      .filter((row) => withinDateRange(new Date(row.generatedAt), filters.dateFrom, filters.dateTo))
      .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt));

    return NextResponse.json({
      rows,
      total: rows.length,
      filters,
    });
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }

    const message = error instanceof Error ? error.message : "Failed to fetch document registry.";
    return jsonError("System Error", message, 500);
  }
}
