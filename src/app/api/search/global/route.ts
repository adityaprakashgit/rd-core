import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { authorize, AuthorizationError } from "@/lib/rbac";
import { getCurrentUserFromRequest } from "@/lib/session";

export const dynamic = "force-dynamic";

type SearchResultItem = {
  id: string;
  type: "lot" | "job" | "sample" | "packet" | "dispatch" | "certificate";
  label: string;
  subLabel: string;
  href: string;
};

type SearchPayload = {
  query: string;
  groups: {
    lots: SearchResultItem[];
    jobs: SearchResultItem[];
    samples: SearchResultItem[];
    packets: SearchResultItem[];
    dispatches: SearchResultItem[];
    certificates: SearchResultItem[];
  };
};

function jsonError(error: string, details: string, status: number) {
  return NextResponse.json({ error, details }, { status });
}

function normalizeQuery(value: string | null): string {
  return (value ?? "").trim();
}

function textMatch(value: string | null | undefined, query: string): boolean {
  if (!value) {
    return false;
  }
  return value.toLowerCase().includes(query.toLowerCase());
}

function buildCertificateNumber(jobReferenceNumber: string | null | undefined): string {
  if (!jobReferenceNumber) {
    return "";
  }
  return `CERT/${jobReferenceNumber}`;
}

function uniqById(items: SearchResultItem[]): SearchResultItem[] {
  const seen = new Set<string>();
  const output: SearchResultItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    output.push(item);
  }
  return output;
}

function capGroup(items: SearchResultItem[], max = 8): SearchResultItem[] {
  return uniqById(items).slice(0, max);
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "READ_ONLY");

    const query = normalizeQuery(request.nextUrl.searchParams.get("q"));
    if (query.length < 2) {
      return NextResponse.json({
        query,
        groups: {
          lots: [],
          jobs: [],
          samples: [],
          packets: [],
          dispatches: [],
          certificates: [],
        },
      } satisfies SearchPayload);
    }

    const jobs = await prisma.inspectionJob.findMany({
      where: {
        companyId: currentUser.companyId,
        OR: [
          { inspectionSerialNumber: { contains: query, mode: "insensitive" } },
          { jobReferenceNumber: { contains: query, mode: "insensitive" } },
          { clientName: { contains: query, mode: "insensitive" } },
          { commodity: { contains: query, mode: "insensitive" } },
          { plantLocation: { contains: query, mode: "insensitive" } },
          {
            samples: {
              some: {
                OR: [
                  { sampleCode: { contains: query, mode: "insensitive" } },
                  { sealLabel: { sealNo: { contains: query, mode: "insensitive" } } },
                  {
                    packets: {
                      some: {
                        OR: [
                          { packetCode: { contains: query, mode: "insensitive" } },
                          { allocation: { allocatedToId: { contains: query, mode: "insensitive" } } },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          },
          {
            lots: {
              some: {
                OR: [
                  { lotNumber: { contains: query, mode: "insensitive" } },
                  { materialName: { contains: query, mode: "insensitive" } },
                  {
                    sample: {
                      OR: [
                        { sampleCode: { contains: query, mode: "insensitive" } },
                        { sealLabel: { sealNo: { contains: query, mode: "insensitive" } } },
                        {
                          packets: {
                            some: {
                              OR: [
                                { packetCode: { contains: query, mode: "insensitive" } },
                                { allocation: { allocatedToId: { contains: query, mode: "insensitive" } } },
                              ],
                            },
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            },
          },
        ],
      },
      take: 60,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        inspectionSerialNumber: true,
        jobReferenceNumber: true,
        clientName: true,
        status: true,
        lots: {
          select: {
            id: true,
            lotNumber: true,
            materialName: true,
            sample: {
              select: {
                id: true,
                sampleCode: true,
                sealLabel: {
                  select: {
                    sealNo: true,
                  },
                },
                packets: {
                  select: {
                    id: true,
                    packetCode: true,
                    allocation: {
                      select: {
                        id: true,
                        allocationStatus: true,
                        allocatedToId: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        samples: {
          select: {
            id: true,
            sampleCode: true,
            sealLabel: {
              select: {
                sealNo: true,
              },
            },
            packets: {
              select: {
                id: true,
                packetCode: true,
                allocation: {
                  select: {
                    id: true,
                    allocationStatus: true,
                    allocatedToId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const groups: SearchPayload["groups"] = {
      lots: [],
      jobs: [],
      samples: [],
      packets: [],
      dispatches: [],
      certificates: [],
    };

    for (const job of jobs) {
      const jobNumber = job.inspectionSerialNumber || job.jobReferenceNumber || "Job";
      const certNo = buildCertificateNumber(job.jobReferenceNumber);

      if (
        textMatch(job.inspectionSerialNumber, query) ||
        textMatch(job.jobReferenceNumber, query) ||
        textMatch(job.clientName, query)
      ) {
        groups.jobs.push({
          id: `job-${job.id}`,
          type: "job",
          label: jobNumber,
          subLabel: `${job.clientName} • ${job.status}`,
          href: `/operations/job/${job.id}`,
        });
      }

      if (textMatch(certNo, query)) {
        groups.certificates.push({
          id: `certificate-${job.id}`,
          type: "certificate",
          label: certNo,
          subLabel: `Job ${jobNumber}`,
          href: `/documents?job=${encodeURIComponent(jobNumber)}&documentType=COA`,
        });
      }

      for (const lot of job.lots) {
        if (textMatch(lot.lotNumber, query) || textMatch(lot.materialName, query)) {
          groups.lots.push({
            id: `lot-${lot.id}`,
            type: "lot",
            label: lot.lotNumber,
            subLabel: `${jobNumber}${lot.materialName ? ` • ${lot.materialName}` : ""}`,
            href: `/jobs/${job.id}/workflow?lotId=${lot.id}&section=lots`,
          });
        }

        const sample = lot.sample;
        if (!sample) {
          continue;
        }

        if (textMatch(sample.sampleCode, query) || textMatch(sample.sealLabel?.sealNo, query)) {
          groups.samples.push({
            id: `sample-${sample.id}`,
            type: "sample",
            label: sample.sampleCode || "Sample",
            subLabel: `Homogeneous sample • ${jobNumber}`,
            href: `/jobs/${job.id}/workflow?section=sampling`,
          });
        }

        for (const packet of sample.packets) {
          if (textMatch(packet.packetCode, query)) {
            groups.packets.push({
              id: `packet-${packet.id}`,
              type: "packet",
              label: packet.packetCode,
              subLabel: `Job packet • ${jobNumber}`,
              href: `/operations/job/${job.id}/packet`,
            });
          }

          const dispatchId = packet.allocation?.id ?? packet.allocation?.allocatedToId ?? null;
          if (dispatchId && textMatch(dispatchId, query)) {
            groups.dispatches.push({
              id: `dispatch-${packet.id}`,
              type: "dispatch",
              label: dispatchId,
              subLabel: `${packet.packetCode} • ${packet.allocation?.allocationStatus ?? "Unknown"}`,
              href: `/operations/job/${job.id}/packet`,
            });
          }
        }
      }

      for (const sample of job.samples) {
        if (textMatch(sample.sampleCode, query) || textMatch(sample.sealLabel?.sealNo, query)) {
          groups.samples.push({
            id: `sample-${sample.id}`,
            type: "sample",
            label: sample.sampleCode || "Sample",
            subLabel: `Homogeneous sample • ${jobNumber}`,
            href: `/jobs/${job.id}/workflow?section=sampling`,
          });
        }

        for (const packet of sample.packets) {
          if (textMatch(packet.packetCode, query)) {
            groups.packets.push({
              id: `packet-${packet.id}`,
              type: "packet",
              label: packet.packetCode,
              subLabel: `Job packet • ${jobNumber}`,
              href: `/operations/job/${job.id}/packet`,
            });
          }

          const dispatchId = packet.allocation?.id ?? packet.allocation?.allocatedToId ?? null;
          if (dispatchId && textMatch(dispatchId, query)) {
            groups.dispatches.push({
              id: `dispatch-${packet.id}`,
              type: "dispatch",
              label: dispatchId,
              subLabel: `${packet.packetCode} • ${packet.allocation?.allocationStatus ?? "Unknown"}`,
              href: `/operations/job/${job.id}/packet`,
            });
          }
        }
      }
    }

    return NextResponse.json({
      query,
      groups: {
        lots: capGroup(groups.lots),
        jobs: capGroup(groups.jobs),
        samples: capGroup(groups.samples),
        packets: capGroup(groups.packets),
        dispatches: capGroup(groups.dispatches),
        certificates: capGroup(groups.certificates),
      },
    } satisfies SearchPayload);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, error.status);
    }
    const message = error instanceof Error ? error.message : "Global search failed.";
    return jsonError("Search Error", message, 500);
  }
}
