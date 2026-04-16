import { WorkflowEscalationStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { authorize, AuthorizationError } from "@/lib/rbac";
import { getCurrentUserFromRequest } from "@/lib/session";

export const dynamic = "force-dynamic";

type ExceptionQueueFilters = {
  lot?: string;
  packet?: string;
  job?: string;
  status?: string;
};

type ExceptionQueueRow = {
  id: string;
  exceptionType: string;
  jobId: string | null;
  jobNumber: string;
  lotId: string | null;
  lotNumber: string;
  packetId: string | null;
  packetCode: string | null;
  blockingStage: string;
  ageHours: number;
  ownerId: string | null;
  owner: string;
  slaState: "On Track" | "Due Soon" | "Overdue";
  source: "Derived" | "Escalation";
  status: string;
  blockerText: string;
  links: {
    job: string | null;
    lot: string | null;
    packet: string | null;
    documents: string | null;
  };
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

function parseFilters(request: NextRequest): ExceptionQueueFilters {
  return {
    lot: normalizeFilter(request.nextUrl.searchParams.get("lot")) ?? undefined,
    packet: normalizeFilter(request.nextUrl.searchParams.get("packet")) ?? undefined,
    job: normalizeFilter(request.nextUrl.searchParams.get("job")) ?? undefined,
    status: normalizeFilter(request.nextUrl.searchParams.get("status")) ?? undefined,
  };
}

function ageHoursFrom(value: Date): number {
  return Math.max(0, Math.floor((Date.now() - value.getTime()) / (1000 * 60 * 60)));
}

function resolveSla(ageHours: number): "On Track" | "Due Soon" | "Overdue" {
  if (ageHours >= 48) {
    return "Overdue";
  }
  if (ageHours >= 24) {
    return "Due Soon";
  }
  return "On Track";
}

function userName(input: { profile?: { displayName?: string | null } | null } | null | undefined): string {
  return input?.profile?.displayName?.trim() || "Unassigned";
}

function rowMatch(rowValue: string | null | undefined, filter?: string): boolean {
  if (!filter) {
    return true;
  }
  if (!rowValue) {
    return false;
  }
  return rowValue.toLowerCase().includes(filter.toLowerCase());
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "READ_ONLY");

    const filters = parseFilters(request);

    const [jobs, escalations] = await Promise.all([
      prisma.inspectionJob.findMany({
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
        take: 300,
        select: {
          id: true,
          inspectionSerialNumber: true,
          jobReferenceNumber: true,
          status: true,
          createdAt: true,
          assignedToId: true,
          assignedTo: {
            select: {
              profile: {
                select: {
                  displayName: true,
                },
              },
            },
          },
          reportSnapshots: {
            select: {
              id: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
          lots: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              lotNumber: true,
              createdAt: true,
              assignedToId: true,
              assignedTo: {
                select: {
                  profile: {
                    select: { displayName: true },
                  },
                },
              },
              sample: {
                select: {
                  id: true,
                  sampleCode: true,
                  sampleStatus: true,
                  createdAt: true,
                  packets: {
                    select: {
                      id: true,
                      packetCode: true,
                      createdAt: true,
                      allocation: {
                        select: {
                          allocationStatus: true,
                        },
                      },
                    },
                  },
                },
              },
              trials: {
                select: {
                  id: true,
                  measurements: {
                    select: { id: true },
                  },
                },
              },
            },
          },
          samples: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              sampleCode: true,
              sampleStatus: true,
              createdAt: true,
              packets: {
                select: {
                  id: true,
                  packetCode: true,
                  createdAt: true,
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
      }),
      prisma.workflowEscalation.findMany({
        where: {
          companyId: currentUser.companyId,
          ...(filters.status
            ? {
                status: filters.status as WorkflowEscalationStatus,
              }
            : {
                status: { not: WorkflowEscalationStatus.RESOLVED },
              }),
        },
        orderBy: { createdAt: "desc" },
        take: 300,
        select: {
          id: true,
          type: true,
          title: true,
          status: true,
          createdAt: true,
          jobId: true,
          lotId: true,
          assignedToUserId: true,
          assignedToUser: {
            select: {
              profile: {
                select: {
                  displayName: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const reportVersions = jobs.length
      ? await prisma.rndReportVersion.findMany({
          where: {
            companyId: currentUser.companyId,
            parentJobId: { in: jobs.map((job) => job.id) },
            precedence: "ACTIVE",
          },
          select: {
            parentJobId: true,
            sampleId: true,
          },
        })
      : [];
    const activeReportLineage = new Set(reportVersions.map((row) => `${row.parentJobId}::${row.sampleId}`));

    const derivedRows: ExceptionQueueRow[] = [];

    for (const job of jobs) {
      const jobNumber = job.inspectionSerialNumber || job.jobReferenceNumber;
      const jobSample = job.samples[0] ?? null;
      const ownerId = job.assignedToId || null;
      const ownerName = userName(job.assignedTo);
      const hasCoa = jobSample
        ? activeReportLineage.has(`${job.id}::${jobSample.id}`) || job.reportSnapshots.length > 0
        : job.reportSnapshots.length > 0;

      if (!jobSample) {
        const ageHours = ageHoursFrom(job.createdAt);
        derivedRows.push({
          id: `derived-no-sample-${job.id}`,
          exceptionType: "Job without homogeneous sample",
          jobId: job.id,
          jobNumber,
          lotId: null,
          lotNumber: "Job-level",
          packetId: null,
          packetCode: null,
          blockingStage: "Homogeneous Sampling",
          ageHours,
          ownerId,
          owner: ownerName,
          slaState: resolveSla(ageHours),
          source: "Derived",
          status: "OPEN",
          blockerText: "Create the job-level homogeneous sample after all lots pass inspection.",
          links: {
            job: `/jobs/${job.id}/workflow?section=sampling`,
            lot: null,
            packet: null,
            documents: `/documents?job=${jobNumber}`,
          },
        });
        continue;
      }

      if (!hasCoa) {
        const ageHours = ageHoursFrom(jobSample.createdAt);
        derivedRows.push({
          id: `derived-rnd-pending-${jobSample.id}`,
          exceptionType: "Homogeneous sample without approved R&D result",
          jobId: job.id,
          jobNumber,
          lotId: null,
          lotNumber: "Job-level",
          packetId: null,
          packetCode: null,
          blockingStage: "Lab Testing",
          ageHours,
          ownerId,
          owner: ownerName,
          slaState: resolveSla(ageHours),
          source: "Derived",
          status: "OPEN",
          blockerText: "R&D attempts are not completed/approved for the job-level homogeneous sample.",
          links: {
            job: `/userrd/job/${job.id}`,
            lot: null,
            packet: null,
            documents: `/documents?job=${jobNumber}`,
          },
        });
      }

      for (const packet of jobSample.packets) {
          const packetAge = ageHoursFrom(packet.createdAt);
          const allocationStatus = packet.allocation?.allocationStatus || "BLOCKED";

          if (!hasCoa) {
            derivedRows.push({
              id: `derived-packet-no-coa-${packet.id}`,
              exceptionType: "Packet without COA",
              jobId: job.id,
              jobNumber,
              lotId: null,
              lotNumber: "Job-level",
              packetId: packet.id,
              packetCode: packet.packetCode,
              blockingStage: "Report",
              ageHours: packetAge,
              ownerId,
              owner: ownerName,
              slaState: resolveSla(packetAge),
              source: "Derived",
              status: "OPEN",
              blockerText: "COA is missing for packet release.",
              links: {
                job: `/userrd/job/${job.id}`,
                lot: null,
                packet: `/operations/job/${job.id}/packet`,
                documents: `/documents?job=${jobNumber}&packet=${packet.packetCode}`,
              },
            });
          }

          if (["ALLOCATED", "USED"].includes(allocationStatus) && !hasCoa) {
            derivedRows.push({
              id: `derived-dispatch-doc-missing-${packet.id}`,
              exceptionType: "Dispatch without attached documents",
              jobId: job.id,
              jobNumber,
              lotId: null,
              lotNumber: "Job-level",
              packetId: packet.id,
              packetCode: packet.packetCode,
              blockingStage: "Packing List",
              ageHours: packetAge,
              ownerId,
              owner: ownerName,
              slaState: resolveSla(packetAge),
              source: "Derived",
              status: "OPEN",
              blockerText: "Dispatch cannot proceed until required documents are attached.",
              links: {
                job: `/reports?job=${job.id}`,
                lot: null,
                packet: `/operations/job/${job.id}/packet`,
                documents: `/documents?job=${jobNumber}&packet=${packet.packetCode}`,
              },
            });
          }
      }

        if (!["APPROVED", "READY_FOR_PACKETING"].includes(jobSample.sampleStatus)) {
          const ageHours = ageHoursFrom(jobSample.createdAt);
          if (ageHours >= 48) {
            derivedRows.push({
              id: `derived-overdue-approval-${jobSample.id}`,
              exceptionType: "Overdue approvals",
              jobId: job.id,
              jobNumber,
              lotId: null,
              lotNumber: "Job-level",
              packetId: null,
              packetCode: null,
              blockingStage: "Final Pass",
              ageHours,
              ownerId,
              owner: ownerName,
              slaState: resolveSla(ageHours),
              source: "Derived",
              status: "OPEN",
              blockerText: "Approval is overdue and blocks progression.",
              links: {
                job: `/jobs/${job.id}/workflow?section=sampling`,
                lot: null,
                packet: null,
                documents: `/documents?job=${jobNumber}`,
              },
            });
          }
        }
    }

    const escalationRows: ExceptionQueueRow[] = escalations.map((entry) => {
      const ageHours = ageHoursFrom(entry.createdAt);
      return {
        id: `escalation-${entry.id}`,
        exceptionType: entry.title,
        jobId: entry.jobId ?? null,
        jobNumber: entry.jobId ? entry.jobId.slice(0, 8) : "—",
        lotId: entry.lotId ?? null,
        lotNumber: entry.lotId ? entry.lotId.slice(0, 8) : "—",
        packetId: null,
        packetCode: null,
        blockingStage: "Workflow Escalation",
        ageHours,
        ownerId: entry.assignedToUserId ?? null,
        owner: userName(entry.assignedToUser),
        slaState: resolveSla(ageHours),
        source: "Escalation",
        status: entry.status,
        blockerText: "Escalation must be acknowledged or resolved before workflow continues.",
        links: {
          job: entry.jobId ? `/operations/job/${entry.jobId}` : null,
          lot: entry.jobId && entry.lotId ? `/operations/job/${entry.jobId}/lot/${entry.lotId}` : null,
          packet: null,
          documents: entry.jobId ? `/documents?job=${entry.jobId}` : null,
        },
      };
    });

    const merged = [...derivedRows, ...escalationRows]
      .filter((row) => rowMatch(row.lotNumber, filters.lot))
      .filter((row) => rowMatch(row.packetCode, filters.packet))
      .filter((row) => rowMatch(row.jobNumber, filters.job));

    const roleFiltered = merged.filter((row) => {
      if (currentUser.role === "ADMIN") {
        return true;
      }

      if (currentUser.role === "OPERATIONS") {
        return row.blockingStage !== "Lab Testing" || row.ownerId === currentUser.id;
      }

      if (currentUser.role === "RND") {
        return row.blockingStage === "Lab Testing" || row.ownerId === currentUser.id;
      }

      return row.ownerId === currentUser.id;
    });

    return NextResponse.json({
      rows: roleFiltered.sort((left, right) => right.ageHours - left.ageHours),
      total: roleFiltered.length,
      filters,
    });
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }

    const message = error instanceof Error ? error.message : "Failed to fetch exception queue.";
    return jsonError("System Error", message, 500);
  }
}
