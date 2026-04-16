"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  HStack,
  Input,
  Link,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useRouter } from "next/navigation";

import { EmptyWorkState, InlineErrorState, PageSkeleton } from "@/components/enterprise/AsyncState";
import { EnterpriseDataTable } from "@/components/enterprise/EnterpriseDataTable";
import {
  EnterpriseStickyTable,
  ExceptionBanner,
  FilterSearchStrip,
  PageActionBar,
  PageIdentityBar,
} from "@/components/enterprise/EnterprisePatterns";
import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import { formatHoursDuration, getCurrentMilestoneAgeHours, getCurrentMilestoneStage } from "@/lib/workflow-milestone-display";
import { getJobWorkflowPresentation } from "@/lib/workflow-stage";
import type { InspectionJob } from "@/types/inspection";

type ExceptionRow = {
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

type DocumentRow = {
  id: string;
  documentType: "COA" | "DISPATCH_DOCUMENT" | "TEST_REPORT" | "INSPECTION_UPLOAD" | "PACKET_DOCUMENT";
  jobNumber: string;
  lotNumber: string | null;
};

type QueueResponse = { rows: ExceptionRow[]; total: number };
type DocumentsResponse = { rows: DocumentRow[]; total: number };

type ActiveJobRow = {
  id: string;
  jobNumber: string;
  lots: number;
  currentStage: string;
  pendingAction: string;
  owner: string;
  jobStarted: string;
  sentToAdmin: string;
  adminDecision: string;
  operationsCompleted: string;
  rndHandover: string;
};

type LotAgingRow = {
  id: string;
  lotNumber: string;
  jobNumber: string;
  ageHours: number;
  sampleStatus: string;
  blocker: string;
  stageAge: string;
  currentMilestone: string;
  jobRefId: string;
  lotRefId: string;
};

type ManagerIssueRow = {
  id: string;
  type: string;
  jobNumber: string;
  lotNumber: string;
  stage: string;
  age: string;
  owner: string;
  actionHref: string | null;
};

function toAgeHours(value: string | Date | null | undefined): number {
  if (!value) return 0;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 0;
  return Math.max(Math.floor((Date.now() - parsed.getTime()) / (1000 * 60 * 60)), 0);
}

export default function ManagerWorkspacePage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<InspectionJob[]>([]);
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [jobsRes, exceptionsRes, docsRes] = await Promise.all([
        fetch("/api/jobs?view=my"),
        fetch("/api/exceptions/queue"),
        fetch("/api/documents/registry"),
      ]);

      if (!jobsRes.ok || !exceptionsRes.ok || !docsRes.ok) {
        throw new Error("Manager workspace could not be loaded.");
      }

      const jobsPayload = (await jobsRes.json()) as InspectionJob[];
      const exceptionsPayload = (await exceptionsRes.json()) as QueueResponse;
      const docsPayload = (await docsRes.json()) as DocumentsResponse;

      const nextJobs = Array.isArray(jobsPayload) ? jobsPayload : [];
      const jobNumbers = new Set(nextJobs.map((job) => job.inspectionSerialNumber || job.jobReferenceNumber || ""));

      setJobs(nextJobs);
      setExceptions(Array.isArray(exceptionsPayload.rows) ? exceptionsPayload.rows : []);
      setDocuments((Array.isArray(docsPayload.rows) ? docsPayload.rows : []).filter((row) => jobNumbers.has(row.jobNumber)));
    } catch (loadError) {
      setJobs([]);
      setExceptions([]);
      setDocuments([]);
      setError(loadError instanceof Error ? loadError.message : "Manager workspace could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const activeJobs = useMemo<ActiveJobRow[]>(() => {
    return jobs
      .filter((job) => !["COMPLETED", "DISPATCHED"].includes(job.status))
      .map((job) => {
        const presentation = getJobWorkflowPresentation(job);
        return {
          id: job.id,
          jobNumber: job.inspectionSerialNumber || job.jobReferenceNumber || "—",
          lots: job.lots?.length ?? 0,
          currentStage: presentation.label,
          pendingAction: presentation.nextAction,
          owner: job.assignedTo?.profile?.displayName || "Unassigned",
          jobStarted: job.jobStartedAt ? new Date(job.jobStartedAt).toLocaleString() : "Pending",
          sentToAdmin: job.sentToAdminAt ? new Date(job.sentToAdminAt).toLocaleString() : "Pending",
          adminDecision: job.adminDecisionAt
            ? `${job.adminDecisionStatus || "Decision"} • ${new Date(job.adminDecisionAt).toLocaleString()}`
            : "Pending",
          operationsCompleted: job.operationsCompletedAt ? new Date(job.operationsCompletedAt).toLocaleString() : "Pending",
          rndHandover: job.handedOverToRndAt ? new Date(job.handedOverToRndAt).toLocaleString() : "Pending",
        };
      });
  }, [jobs]);

  const lotAging = useMemo<LotAgingRow[]>(() => {
    const rows: LotAgingRow[] = [];
    for (const job of jobs) {
      const jobNumber = job.inspectionSerialNumber || job.jobReferenceNumber || "—";
      for (const lot of job.lots ?? []) {
        const ageHours = toAgeHours(lot.createdAt);
        const sampleStatus = lot.sample?.sampleStatus ?? "Sample pending";
        const blocker = !lot.sample
          ? "Sample missing"
          : lot.sample.sampleStatus !== "READY_FOR_PACKETING"
            ? "Testing pending"
            : "Awaiting packet/dispatch";
        const stageAgeHours = getCurrentMilestoneAgeHours(job) ?? ageHours;
        rows.push({
          id: `lot-aging-${lot.id}`,
          lotNumber: lot.lotNumber,
          jobNumber,
          ageHours,
          sampleStatus,
          blocker,
          stageAge: formatHoursDuration(stageAgeHours),
          currentMilestone: getCurrentMilestoneStage(job),
          jobRefId: job.id,
          lotRefId: lot.id,
        });
      }
    }

    return rows.sort((left, right) => right.ageHours - left.ageHours);
  }, [jobs]);

  const bottlenecks = useMemo<ManagerIssueRow[]>(() => {
    return exceptions.map((row) => ({
      id: row.id,
      type: row.exceptionType,
      jobNumber: row.jobNumber || "—",
      lotNumber: row.lotNumber || "—",
      stage: row.blockingStage,
      age: `${row.ageHours}h`,
      owner: row.owner,
      actionHref: row.links.lot || row.links.documents || row.links.job,
    }));
  }, [exceptions]);

  const missingDocs = useMemo<ManagerIssueRow[]>(() => {
    const rows: ManagerIssueRow[] = [];
    const docsByJobLot = new Set(documents.map((row) => `${row.jobNumber}:${row.lotNumber ?? "-"}`));

    for (const job of jobs) {
      const jobNumber = job.inspectionSerialNumber || job.jobReferenceNumber || "—";
      for (const lot of job.lots ?? []) {
        const key = `${jobNumber}:${lot.lotNumber}`;
        if (docsByJobLot.has(key)) continue;
        rows.push({
          id: `missing-doc-${job.id}-${lot.id}`,
          type: "Missing documents",
          jobNumber,
          lotNumber: lot.lotNumber,
          stage: "Report",
          age: `${toAgeHours(lot.updatedAt ?? lot.createdAt)}h`,
          owner: lot.assignedTo?.profile?.displayName || job.assignedTo?.profile?.displayName || "Unassigned",
          actionHref: `/documents?job=${jobNumber}&lot=${lot.lotNumber}`,
        });
      }
    }
    return rows;
  }, [documents, jobs]);

  const dispatchDelays = useMemo<ManagerIssueRow[]>(() => {
    return exceptions
      .filter((row) => row.exceptionType.toLowerCase().includes("dispatch") || row.blockingStage.toLowerCase().includes("packing"))
      .map((row) => ({
        id: `dispatch-delay-${row.id}`,
        type: row.exceptionType,
        jobNumber: row.jobNumber || "—",
        lotNumber: row.lotNumber || "—",
        stage: row.blockingStage,
        age: `${row.ageHours}h`,
        owner: row.owner,
        actionHref: row.links.documents || row.links.lot || row.links.job,
      }));
  }, [exceptions]);

  const missingCoa = useMemo<ManagerIssueRow[]>(() => {
    const exceptionMatches = exceptions
      .filter((row) => row.exceptionType.toLowerCase().includes("coa"))
      .map((row) => ({
        id: `missing-coa-${row.id}`,
        type: row.exceptionType,
        jobNumber: row.jobNumber || "—",
        lotNumber: row.lotNumber || "—",
        stage: row.blockingStage,
        age: `${row.ageHours}h`,
        owner: row.owner,
        actionHref: row.links.documents || row.links.lot || row.links.job,
      }));

    const jobDerived: ManagerIssueRow[] = [];
    for (const job of jobs) {
      const hasCoa = (job.reportSnapshots?.length ?? 0) > 0;
      if (hasCoa) continue;
      const jobNumber = job.inspectionSerialNumber || job.jobReferenceNumber || "—";
      for (const lot of job.lots ?? []) {
        if ((lot.sample?.packets?.length ?? 0) === 0) continue;
        jobDerived.push({
          id: `missing-coa-job-${job.id}-${lot.id}`,
          type: "Missing COA",
          jobNumber,
          lotNumber: lot.lotNumber,
          stage: "Report",
          age: `${toAgeHours(lot.updatedAt ?? lot.createdAt)}h`,
          owner: lot.assignedTo?.profile?.displayName || job.assignedTo?.profile?.displayName || "Unassigned",
          actionHref: `/documents?job=${jobNumber}&lot=${lot.lotNumber}`,
        });
      }
    }

    return [...exceptionMatches, ...jobDerived];
  }, [exceptions, jobs]);

  const searchQuery = search.trim().toLowerCase();
  const filterRows = useCallback(
    <T extends { [key: string]: unknown }>(rows: T[], keys: Array<keyof T>): T[] => {
      if (!searchQuery) return rows;
      return rows.filter((row) =>
        keys
          .map((key) => String(row[key] ?? ""))
          .join(" ")
          .toLowerCase()
          .includes(searchQuery)
      );
    },
    [searchQuery]
  );

  const activeJobsFiltered = filterRows(activeJobs, ["jobNumber", "owner", "currentStage", "pendingAction"]);
  const lotAgingFiltered = filterRows(lotAging, ["jobNumber", "lotNumber", "sampleStatus", "blocker"]);
  const bottlenecksFiltered = filterRows(bottlenecks, ["type", "jobNumber", "lotNumber", "stage", "owner"]);
  const missingDocsFiltered = filterRows(missingDocs, ["type", "jobNumber", "lotNumber", "owner"]);
  const dispatchDelaysFiltered = filterRows(dispatchDelays, ["type", "jobNumber", "lotNumber", "owner"]);
  const missingCoaFiltered = filterRows(missingCoa, ["type", "jobNumber", "lotNumber", "owner"]);

  const overdueCount = bottlenecks.filter((row) => row.age.startsWith("48") || row.age.startsWith("49") || row.age.startsWith("5")).length;

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={5}>
        <PageIdentityBar
          title="Manager Workspace"
          subtitle="Active jobs, aging lots, bottlenecks, and document/COA risks in scoped queues"
          breadcrumbs={[{ label: "Manager", href: "/exceptions" }]}
          status={
            <HStack spacing={2}>
              <Badge colorScheme="purple">Manager</Badge>
              <Badge variant="subtle">{activeJobsFiltered.length} active jobs</Badge>
            </HStack>
          }
        />

        <PageActionBar
          secondaryActions={<Text fontSize="sm" color="text.secondary">Queue-first manager oversight with scoped visibility</Text>}
          primaryAction={<Button as={Link} href="/documents" size="sm">Open Documents</Button>}
        />

        {overdueCount > 0 ? (
          <ExceptionBanner
            title="Overdue bottlenecks detected"
            description="One or more workflow bottlenecks are aging and require manager intervention."
            status="warning"
          />
        ) : null}

        <FilterSearchStrip
          filters={<Badge variant="subtle">Scoped Manager View</Badge>}
          search={<Input size="sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search job, lot, owner, issue" maxW={{ base: "full", lg: "320px" }} />}
          actions={<Button size="sm" variant="outline" onClick={() => setSearch("")}>Clear</Button>}
        />

        {loading ? <PageSkeleton cards={2} rows={3} /> : null}
        {!loading && error ? <InlineErrorState title="Manager workspace unavailable" description={error} onRetry={() => void loadWorkspace()} /> : null}

        {!loading && !error ? (
          <VStack align="stretch" spacing={5}>
            <VStack align="stretch" spacing={2}>
              <HStack justify="space-between"><Text fontWeight="semibold">Active jobs</Text><Badge variant="subtle">{activeJobsFiltered.length}</Badge></HStack>
              <EnterpriseStickyTable><EnterpriseDataTable rows={activeJobsFiltered} rowKey={(row) => row.id} emptyLabel="No active jobs." columns={[
                { id: "job", header: "Job Number", render: (row) => row.jobNumber },
                { id: "lots", header: "Lots", render: (row) => row.lots },
                { id: "stage", header: "Current Stage", render: (row) => row.currentStage },
                { id: "pending", header: "Pending Action", render: (row) => row.pendingAction },
                { id: "started", header: "Job Started", render: (row) => row.jobStarted },
                { id: "sent", header: "Sent to Admin", render: (row) => row.sentToAdmin },
                { id: "decision", header: "Admin Decision", render: (row) => row.adminDecision },
                { id: "ops", header: "Operations Completed", render: (row) => row.operationsCompleted },
                { id: "handover", header: "Handed Over to R&D", render: (row) => row.rndHandover },
                { id: "owner", header: "Owner", render: (row) => row.owner },
              ]} rowActions={[{ id: "open-job", label: "Open Job Workflow", onClick: (row) => { const job = jobs.find((entry) => entry.id === row.id); if (job) router.push(`/jobs/${job.id}/workflow`); } }]} /></EnterpriseStickyTable>
            </VStack>

            <VStack align="stretch" spacing={2}>
              <HStack justify="space-between"><Text fontWeight="semibold">Lot aging</Text><Badge variant="subtle">{lotAgingFiltered.length}</Badge></HStack>
              <EnterpriseStickyTable><EnterpriseDataTable rows={lotAgingFiltered} rowKey={(row) => row.id} emptyLabel="No aging lots in scope." columns={[
                { id: "lot", header: "Lot Number", render: (row) => row.lotNumber },
                { id: "job", header: "Job Number", render: (row) => row.jobNumber },
                { id: "age", header: "Age", render: (row) => `${row.ageHours}h` },
                { id: "stage-age", header: "Stage Age", render: (row) => row.stageAge },
                { id: "milestone", header: "Current Milestone", render: (row) => row.currentMilestone },
                { id: "sample", header: "Sample Status", render: (row) => row.sampleStatus },
                { id: "blocker", header: "Blocker", render: (row) => row.blocker },
              ]} rowActions={[{ id: "open-lot", label: "Open Lot Workflow", onClick: (row) => { router.push(`/jobs/${row.jobRefId}/workflow?lotId=${row.lotRefId}&section=lots`); } }]} /></EnterpriseStickyTable>
            </VStack>

            <VStack align="stretch" spacing={2}>
              <HStack justify="space-between"><Text fontWeight="semibold">Workflow bottlenecks</Text><Badge variant="subtle">{bottlenecksFiltered.length}</Badge></HStack>
              <EnterpriseStickyTable><EnterpriseDataTable rows={bottlenecksFiltered} rowKey={(row) => row.id} emptyLabel="No workflow bottlenecks." columns={[
                { id: "type", header: "Issue", render: (row) => row.type },
                { id: "job", header: "Job", render: (row) => row.jobNumber },
                { id: "lot", header: "Lot", render: (row) => row.lotNumber },
                { id: "stage", header: "Blocking Stage", render: (row) => row.stage },
                { id: "age", header: "Age", render: (row) => row.age },
                { id: "owner", header: "Owner", render: (row) => row.owner },
              ]} rowActions={[{ id: "open", label: "Open Job Detail", onClick: (row) => { if (row.actionHref) router.push(row.actionHref); } }]} /></EnterpriseStickyTable>
            </VStack>

            <VStack align="stretch" spacing={2}>
              <HStack justify="space-between"><Text fontWeight="semibold">Missing documents</Text><Badge variant="subtle">{missingDocsFiltered.length}</Badge></HStack>
              <EnterpriseStickyTable><EnterpriseDataTable rows={missingDocsFiltered} rowKey={(row) => row.id} emptyLabel="No missing documents in scope." columns={[
                { id: "type", header: "Issue", render: (row) => row.type },
                { id: "job", header: "Job", render: (row) => row.jobNumber },
                { id: "lot", header: "Lot", render: (row) => row.lotNumber },
                { id: "stage", header: "Stage", render: (row) => row.stage },
                { id: "age", header: "Age", render: (row) => row.age },
                { id: "owner", header: "Owner", render: (row) => row.owner },
              ]} rowActions={[{ id: "open-docs", label: "Open Documents", onClick: (row) => { if (row.actionHref) router.push(row.actionHref); } }]} /></EnterpriseStickyTable>
            </VStack>

            <VStack align="stretch" spacing={2}>
              <HStack justify="space-between"><Text fontWeight="semibold">Dispatch delays</Text><Badge variant="subtle">{dispatchDelaysFiltered.length}</Badge></HStack>
              <EnterpriseStickyTable><EnterpriseDataTable rows={dispatchDelaysFiltered} rowKey={(row) => row.id} emptyLabel="No dispatch delays in scope." columns={[
                { id: "type", header: "Issue", render: (row) => row.type },
                { id: "job", header: "Job", render: (row) => row.jobNumber },
                { id: "lot", header: "Lot", render: (row) => row.lotNumber },
                { id: "stage", header: "Stage", render: (row) => row.stage },
                { id: "age", header: "Age", render: (row) => row.age },
                { id: "owner", header: "Owner", render: (row) => row.owner },
              ]} rowActions={[{ id: "open-delay", label: "Open Dispatch Detail", onClick: (row) => { if (row.actionHref) router.push(row.actionHref); } }]} /></EnterpriseStickyTable>
            </VStack>

            <VStack align="stretch" spacing={2}>
              <HStack justify="space-between"><Text fontWeight="semibold">Missing COA</Text><Badge variant="subtle">{missingCoaFiltered.length}</Badge></HStack>
              <EnterpriseStickyTable><EnterpriseDataTable rows={missingCoaFiltered} rowKey={(row) => row.id} emptyLabel="No missing COA in scope." columns={[
                { id: "type", header: "Issue", render: (row) => row.type },
                { id: "job", header: "Job", render: (row) => row.jobNumber },
                { id: "lot", header: "Lot", render: (row) => row.lotNumber },
                { id: "stage", header: "Stage", render: (row) => row.stage },
                { id: "age", header: "Age", render: (row) => row.age },
                { id: "owner", header: "Owner", render: (row) => row.owner },
              ]} rowActions={[{ id: "open-coa", label: "Open Documents", onClick: (row) => { if (row.actionHref) router.push(row.actionHref); } }]} /></EnterpriseStickyTable>
            </VStack>

            {activeJobsFiltered.length + lotAgingFiltered.length + bottlenecksFiltered.length + missingDocsFiltered.length + dispatchDelaysFiltered.length + missingCoaFiltered.length === 0 ? (
              <EmptyWorkState title="No manager actions" description="All monitored manager queues are currently clear." />
            ) : null}
          </VStack>
        ) : null}
      </VStack>
    </ControlTowerLayout>
  );
}
