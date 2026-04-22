"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, HStack, Input, Select, Spinner, Text, VStack } from "@chakra-ui/react";
import { useRouter } from "next/navigation";

import { InlineErrorState, PageSkeleton } from "@/components/enterprise/AsyncState";
import { EnterpriseDataTable } from "@/components/enterprise/EnterpriseDataTable";
import {
  EnterpriseStickyTable,
  FilterSearchStrip,
  PageActionBar,
  PageIdentityBar,
} from "@/components/enterprise/EnterprisePatterns";
import { getJobWorkflowPresentation } from "@/lib/workflow-stage";
import type { InspectionJob } from "@/types/inspection";

function formatDate(value: string | Date | null | undefined) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

function getSampleStatus(job: InspectionJob): string {
  const lots = job.lots ?? [];
  if (lots.length === 0) {
    return "Not started";
  }
  const ready = lots.filter((lot) => lot.sample?.sampleStatus === "READY_FOR_PACKETING").length;
  if (ready === lots.length) {
    return "Ready";
  }
  if (ready > 0) {
    return `${ready}/${lots.length} ready`;
  }
  return "In progress";
}

function getLotReference(job: InspectionJob): string {
  const lots = job.lots ?? [];
  if (lots.length === 0) {
    return "No bags";
  }
  if (lots.length === 1) {
      return lots[0]?.lotNumber ?? "1 bag";
  }
    return `${lots[0]?.lotNumber ?? "Bag"} +${lots.length - 1}`;
}

export function InspectionListWorkspace({
  title,
  subtitle,
  jobsEndpoint,
  createHref,
  detailHref,
  lotHref,
  statusBadge,
  onArchive,
  canArchive = false,
}: {
  title: string;
  subtitle: string;
  jobsEndpoint: string;
  createHref: string;
  detailHref: (job: InspectionJob) => string;
  lotHref?: (job: InspectionJob, lotId: string) => string;
  statusBadge?: string;
  onArchive?: (job: InspectionJob) => Promise<void> | void;
  canArchive?: boolean;
}) {
  const router = useRouter();
  const [jobs, setJobs] = useState<InspectionJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshingList, setIsRefreshingList] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("all");
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const fetchJobs = useCallback(async (options?: { initial?: boolean }) => {
    const isInitial = options?.initial ?? false;
    if (isInitial) {
      setLoading(true);
    } else {
      setIsRefreshingList(true);
    }
    setError(null);
    try {
      const res = await fetch(jobsEndpoint);
      if (!res.ok) {
        throw new Error("Inspection queue could not be loaded.");
      }
      const data = await res.json();
      setJobs(Array.isArray(data) ? data : []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Inspection queue could not be loaded.");
    } finally {
      if (isInitial) {
        setLoading(false);
      } else {
        setIsRefreshingList(false);
      }
    }
  }, [jobsEndpoint]);

  useEffect(() => {
    void fetchJobs({ initial: true });
  }, [fetchJobs]);

  const filtered = useMemo(() => {
    return jobs.filter((job) => {
      const presentation = getJobWorkflowPresentation(job);
      const matchesStage = stage === "all" || presentation.label.toLowerCase() === stage;
      const lookup = [
        job.inspectionSerialNumber,
        job.clientName,
        job.plantLocation ?? "",
        getLotReference(job),
      ]
        .join(" ")
        .toLowerCase();
      const matchesSearch = !search || lookup.includes(search.toLowerCase());
      return matchesStage && matchesSearch;
    });
  }, [jobs, search, stage]);

  const stageOptions = useMemo(() => {
    const labels = new Set<string>();
    jobs.forEach((job) => labels.add(getJobWorkflowPresentation(job).label.toLowerCase()));
    return ["all", ...Array.from(labels)];
  }, [jobs]);

  const tableRows = useMemo(
    () => [...filtered].sort((left, right) => Number(new Date(right.updatedAt)) - Number(new Date(left.updatedAt))),
    [filtered],
  );

  return (
    <VStack align="stretch" spacing={4}>
      <PageIdentityBar
        title={title}
        subtitle={subtitle}
        status={
          <HStack spacing={2}>
            {statusBadge ? (
              <Badge colorScheme="brand" variant="subtle">
                {statusBadge}
              </Badge>
            ) : null}
            <Badge colorScheme="gray" variant="subtle">
              {tableRows.length} inspections
            </Badge>
          </HStack>
        }
      />

      <PageActionBar
        primaryAction={
          <Button onClick={() => router.push(createHref)}>
            Create Job
          </Button>
        }
        secondaryActions={
          <HStack spacing={2}>
            <Text fontSize="sm" color="text.secondary">Table-first execution queue</Text>
            {isRefreshingList ? (
              <HStack spacing={1}>
                <Spinner size="xs" color="text.secondary" />
                <Text fontSize="sm" color="text.secondary">Updating...</Text>
              </HStack>
            ) : null}
          </HStack>
        }
      />

      <FilterSearchStrip
        filters={
          <Select value={stage} onChange={(event) => setStage(event.target.value)} maxW="220px" size="sm">
            {stageOptions.map((option) => (
              <option key={option} value={option}>
                {option === "all" ? "All stages" : option}
              </option>
            ))}
          </Select>
        }
        search={<Input placeholder="Search job, customer, bag, plant" value={search} onChange={(event) => setSearch(event.target.value)} size="sm" maxW={{ base: "full", lg: "320px" }} />}
        actions={<Button size="sm" variant="outline" onClick={() => { setSearch(""); setStage("all"); }}>Clear</Button>}
      />

      {loading ? <PageSkeleton cards={2} rows={3} /> : null}
      {!loading && error ? <InlineErrorState title="Inspection queue unavailable" description={error} onRetry={() => void fetchJobs({ initial: true })} /> : null}
      {!loading && !error ? (
        <EnterpriseStickyTable p={3}>
          <EnterpriseDataTable
              rows={tableRows}
              rowKey={(row) => row.id}
              emptyLabel="No inspections match these filters."
              columns={[
                {
                  id: "inspection-id",
                  header: "Job Number",
                  render: (row) => (
                    <Text fontWeight="semibold">
                      {row.inspectionSerialNumber || row.jobReferenceNumber || "—"}
                    </Text>
                  ),
                },
                { id: "date", header: "Date", render: (row) => formatDate(row.updatedAt || row.createdAt) },
                { id: "source", header: "Source / Vendor / Plant", render: (row) => row.plantLocation ? `${row.clientName} • ${row.plantLocation}` : row.clientName },
                { id: "lot-id", header: "Bag Number", render: (row) => getLotReference(row) },
                {
                  id: "sample-status",
                  header: "Sample Status",
                  render: (row) => <Badge colorScheme="blue" variant="subtle">{getSampleStatus(row)}</Badge>,
                },
                { id: "assigned-user", header: "Assigned User", render: (row) => row.assignedTo?.profile?.displayName || "Unassigned" },
                {
                  id: "stage",
                  header: "Current Stage",
                  render: (row) => {
                    const presentation = getJobWorkflowPresentation(row);
                    return <Badge colorScheme={presentation.tone} variant="subtle">{presentation.label}</Badge>;
                  },
                },
                {
                  id: "primary-action",
                  header: "Primary Actions",
                  render: (row) => {
                    const presentation = getJobWorkflowPresentation(row);
                    return (
                      <Button size="sm" onClick={() => router.push(detailHref(row))}>
                        {presentation.nextAction}
                      </Button>
                    );
                  },
                },
              ]}
              rowActions={[
                {
                  id: "open-detail",
                  label: "Open Job Detail",
                  onClick: (row) => router.push(detailHref(row)),
                },
                {
                  id: "open-lot",
                  label: "Open Bag Detail",
                  onClick: (row) => {
                    const lot = row.lots?.[0];
                    if (lot) {
                      router.push(lotHref ? lotHref(row, lot.id) : `${detailHref(row)}/lot/${lot.id}`);
                    } else {
                      router.push(detailHref(row));
                    }
                  },
                },
                {
                  id: "open-lot-workflow",
                  label: "Open Bag Workflow",
                  onClick: (row) => {
                    const lot = row.lots?.[0];
                    if (lot) {
                      router.push(lotHref ? lotHref(row, lot.id) : `${detailHref(row)}/lot/${lot.id}`);
                    }
                  },
                  isDisabled: (row) => !(row.lots?.[0]?.id),
                },
                ...(canArchive && onArchive
                  ? [
                      {
                        id: "archive",
                        label: archivingId ? "Archiving..." : "Archive",
                        onClick: async (row: InspectionJob) => {
                          if (archivingId) {
                            return;
                          }
                          setArchivingId(row.id);
                          try {
                            await onArchive(row);
                            await fetchJobs({ initial: false });
                          } finally {
                            setArchivingId(null);
                          }
                        },
                        isDisabled: () => Boolean(archivingId),
                      },
                    ]
                  : []),
              ]}
            />
        </EnterpriseStickyTable>
      ) : null}
    </VStack>
  );
}
