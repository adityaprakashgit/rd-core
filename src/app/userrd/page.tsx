"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Box, Button, HStack, Input, Select, Text, VStack } from "@chakra-ui/react";
import { useRouter } from "next/navigation";

import { EmptyWorkState, InlineErrorState, PageSkeleton } from "@/components/enterprise/AsyncState";
import { EnterpriseDataTable } from "@/components/enterprise/EnterpriseDataTable";
import {
  EnterpriseStickyTable,
  FilterSearchStrip,
  PageActionBar,
  PageIdentityBar,
} from "@/components/enterprise/EnterprisePatterns";
import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import type { InspectionJob, RDTrial } from "@/types/inspection";

type QueueBucket = "Pending Samples" | "In Testing" | "Awaiting Review" | "Completed";

type RdQueueRow = {
  id: string;
  bucket: QueueBucket;
  sampleId: string;
  lotId: string;
  jobId: string;
  receivedDate: string;
  testType: string;
  priority: "High" | "Medium" | "Low";
  assignedUser: string;
  dueStatus: "On Track" | "Due Soon" | "Overdue";
  jobRefId: string;
  lotRefId: string;
};

function formatDate(value: string | Date | null | undefined) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

function toAgeHours(value: string | Date | null | undefined) {
  if (!value) {
    return 0;
  }
  const ms = Date.now() - Number(new Date(value));
  return ms > 0 ? Math.floor(ms / (1000 * 60 * 60)) : 0;
}

function deriveDueStatus(receivedDate: string | Date | null | undefined): "On Track" | "Due Soon" | "Overdue" {
  const ageHours = toAgeHours(receivedDate);
  if (ageHours >= 48) {
    return "Overdue";
  }
  if (ageHours >= 24) {
    return "Due Soon";
  }
  return "On Track";
}

function priorityFromBucket(bucket: QueueBucket, dueStatus: "On Track" | "Due Soon" | "Overdue"): "High" | "Medium" | "Low" {
  if (bucket === "Completed") {
    return "Low";
  }
  if (bucket === "Awaiting Review" || dueStatus === "Overdue") {
    return "High";
  }
  return "Medium";
}

function colorForDue(dueStatus: RdQueueRow["dueStatus"]) {
  if (dueStatus === "Overdue") {
    return "red";
  }
  if (dueStatus === "Due Soon") {
    return "orange";
  }
  return "green";
}

function colorForPriority(priority: RdQueueRow["priority"]) {
  if (priority === "High") {
    return "red";
  }
  if (priority === "Medium") {
    return "orange";
  }
  return "gray";
}

export default function UserRdDashboard() {
  const router = useRouter();
  const [jobs, setJobs] = useState<InspectionJob[]>([]);
  const [trialMap, setTrialMap] = useState<Record<string, RDTrial[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [bucketFilter, setBucketFilter] = useState("all");

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const jobsRes = await fetch("/api/jobs?view=all");
      if (!jobsRes.ok) {
        throw new Error("R&D queue could not be loaded.");
      }
      const jobItems = (await jobsRes.json()) as InspectionJob[];
      const nextJobs = Array.isArray(jobItems) ? jobItems : [];
      setJobs(nextJobs);

      const trialEntries = await Promise.all(
        nextJobs.map(async (job) => {
          const res = await fetch(`/api/rd/trial?jobId=${job.id}`);
          if (!res.ok) {
            return [job.id, []] as const;
          }
          const trials = (await res.json()) as RDTrial[];
          return [job.id, Array.isArray(trials) ? trials : []] as const;
        }),
      );
      setTrialMap(Object.fromEntries(trialEntries));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "R&D queue could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  const rows = useMemo(() => {
    const result: RdQueueRow[] = [];
    for (const job of jobs) {
      const jobTrials = trialMap[job.id] ?? [];
      for (const lot of job.lots ?? []) {
        const sample = lot.sample;
        const lotTrials = jobTrials.filter((trial) => trial.lotId === lot.id);
        const anyTrial = lotTrials.length > 0;
        const anyTrialIncomplete = lotTrials.some((trial) => trial.measurements.length === 0);
        const allTrialsMeasured = anyTrial && lotTrials.every((trial) => trial.measurements.length > 0);

        let bucket: QueueBucket = "Pending Samples";
        if (["LOCKED", "COMPLETED", "DISPATCHED"].includes(job.status)) {
          bucket = "Completed";
        } else if (anyTrial && anyTrialIncomplete) {
          bucket = "In Testing";
        } else if (allTrialsMeasured) {
          bucket = "Awaiting Review";
        }

        const receivedBase = sample?.samplingDate ?? sample?.createdAt ?? lot.createdAt;
        const dueStatus = deriveDueStatus(receivedBase);
        const priority = priorityFromBucket(bucket, dueStatus);
        const assignedUser =
          sample?.createdBy?.profile?.displayName ||
          lot.assignedTo?.profile?.displayName ||
          job.assignedTo?.profile?.displayName ||
          "Unassigned";

        result.push({
          id: `${job.id}:${lot.id}`,
          bucket,
          sampleId: sample?.sampleCode || "—",
          lotId: lot.lotNumber,
          jobId: job.inspectionSerialNumber || job.jobReferenceNumber || "—",
          receivedDate: formatDate(receivedBase),
          testType: sample?.sampleType || "Standard Assay",
          priority,
          assignedUser,
          dueStatus,
          jobRefId: job.id,
          lotRefId: lot.id,
        });
      }
    }
    return result;
  }, [jobs, trialMap]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const searchHit =
        !search ||
        [row.sampleId, row.lotId, row.jobId, row.testType, row.assignedUser, row.dueStatus]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase());
      const bucketHit = bucketFilter === "all" || row.bucket.toLowerCase() === bucketFilter;
      return searchHit && bucketHit;
    });
  }, [rows, search, bucketFilter]);

  const queueSections = useMemo(() => {
    const pendingSamples = filteredRows.filter((row) => row.bucket === "Pending Samples");
    const inProgressTests = filteredRows.filter((row) => row.bucket === "In Testing");
    const awaitingReview = filteredRows.filter((row) => row.bucket === "Awaiting Review");
    const overdueTesting = filteredRows.filter((row) => row.dueStatus === "Overdue" && row.bucket !== "Completed");
    return {
      pendingSamples,
      inProgressTests,
      awaitingReview,
      overdueTesting,
    };
  }, [filteredRows]);

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={4}>
        <PageIdentityBar
          title="R&D Queue"
          subtitle="Action-first R&D workspace for pending samples, testing, approvals, and overdue items."
          status={
            <HStack spacing={2}>
              <Badge colorScheme="purple" variant="subtle">
                R&D
              </Badge>
              <Badge colorScheme="gray" variant="subtle">
                {rows.length} sample rows
              </Badge>
            </HStack>
          }
        />

        <PageActionBar
          primaryAction={<Button onClick={() => router.push("/rd")}>Create Job</Button>}
          secondaryActions={<Text fontSize="sm" color="text.secondary">Queues: Pending Samples / In-progress Tests / Awaiting Review / Overdue Testing</Text>}
        />

        <FilterSearchStrip
          filters={
            <Select value={bucketFilter} onChange={(event) => setBucketFilter(event.target.value)} maxW="240px" size="sm">
              <option value="all">All buckets</option>
              <option value="pending samples">Pending Samples</option>
              <option value="in testing">In Testing</option>
              <option value="awaiting review">Awaiting Review</option>
              <option value="completed">Completed</option>
            </Select>
          }
          search={
            <Input
              size="sm"
              placeholder="Search sample, lot, job, test type, assignee"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              maxW={{ base: "full", lg: "320px" }}
            />
          }
          actions={<Button size="sm" variant="outline" onClick={() => { setSearch(""); setBucketFilter("all"); }}>Clear</Button>}
        />

        {loading ? <PageSkeleton cards={3} rows={2} /> : null}
        {!loading && error ? <InlineErrorState title="R&D queue unavailable" description={error} onRetry={() => void fetchJobs()} /> : null}
        {!loading && !error ? (
          <VStack align="stretch" spacing={5}>
            {[
              { id: "pending", label: "Pending samples", rows: queueSections.pendingSamples },
              { id: "in-testing", label: "In-progress tests", rows: queueSections.inProgressTests },
              { id: "awaiting-review", label: "Awaiting Review", rows: queueSections.awaitingReview },
              { id: "overdue", label: "Overdue testing items", rows: queueSections.overdueTesting },
            ].map((section) => (
              <VStack key={section.id} align="stretch" spacing={2}>
                <HStack justify="space-between">
                  <Text fontWeight="semibold">{section.label}</Text>
                  <Badge colorScheme={section.id === "overdue" ? "red" : "gray"} variant="subtle">{section.rows.length}</Badge>
                </HStack>
                <EnterpriseStickyTable>
                  <Box p={3}>
                    <EnterpriseDataTable
                      rows={section.rows}
                      rowKey={(row) => `${section.id}-${row.id}`}
                      emptyLabel={`No rows in ${section.label}.`}
                      columns={[
                        { id: "sample-id", header: "Sample ID", render: (row) => row.sampleId },
                        { id: "lot-id", header: "Lot Number", render: (row) => row.lotId },
                        { id: "job-id", header: "Job Number", render: (row) => row.jobId },
                        { id: "received-date", header: "Received Date", render: (row) => row.receivedDate },
                        { id: "test-type", header: "Test type", render: (row) => row.testType },
                        { id: "priority", header: "Priority", render: (row) => <Badge colorScheme={colorForPriority(row.priority)} variant="subtle">{row.priority}</Badge> },
                        { id: "assigned-user", header: "Assigned user", render: (row) => row.assignedUser },
                        { id: "due-status", header: "Due status", render: (row) => <Badge colorScheme={colorForDue(row.dueStatus)} variant="subtle">{row.dueStatus}</Badge> },
                      ]}
                      rowActions={[
                        {
                          id: "open-testing-board",
                          label: "Open Sample Testing Board",
                          onClick: (row) => router.push(`/userrd/job/${row.jobRefId}`),
                        },
                        {
                          id: "open-lot-packet",
                          label: "Open Packet Mapping",
                          onClick: (row) => router.push(`/operations/job/${row.jobRefId}/lot/${row.lotRefId}/packet`),
                        },
                        {
                          id: "open-traceability",
                          label: "Open Traceability",
                          onClick: (row) => router.push(`/traceability/lot/${row.lotRefId}`),
                        },
                      ]}
                    />
                  </Box>
                </EnterpriseStickyTable>
              </VStack>
            ))}
            {filteredRows.length === 0 ? (
              <EmptyWorkState title="No R&D rows found" description="Try a different filter or search term." />
            ) : null}
          </VStack>
        ) : null}
      </VStack>
    </ControlTowerLayout>
  );
}
