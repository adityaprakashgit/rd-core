"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Box, Button, HStack, Input, Select, Text, VStack } from "@chakra-ui/react";
import { useRouter } from "next/navigation";

import { EmptyWorkState, InlineErrorState, PageSkeleton } from "@/components/enterprise/AsyncState";
import { EnterpriseDataTable } from "@/components/enterprise/EnterpriseDataTable";
import { EnterpriseStickyTable, FilterSearchStrip, PageActionBar, PageIdentityBar } from "@/components/enterprise/EnterprisePatterns";
import { getJobWorkflowPresentation } from "@/lib/workflow-stage";
import type { InspectionJob } from "@/types/inspection";

type ProductionWorkspaceHomeProps = {
  title: string;
  subtitle: string;
  jobsEndpoint: string;
  createHref: string;
  detailHref: (job: InspectionJob) => string;
  lotHref: (job: InspectionJob, lotId: string) => string;
  statusBadge?: string;
  canArchive?: boolean;
  onArchive?: (job: InspectionJob) => Promise<void> | void;
};

type PendingInspectionRow = {
  id: string;
  inspectionId: string;
  customer: string;
  lotRef: string;
  sampleStatus: string;
  assignedUser: string;
  stage: string;
  nextAction: string;
  jobRefId: string;
  lotRefId: string | null;
  updatedAt: string | Date;
};

type LotActionRow = {
  id: string;
  lotNumber: string;
  materialName: string;
  sampleStatus: string;
  packetStatus: string;
  blocker: string;
  owner: string;
  jobRefId: string;
  lotRefId: string;
};

type PacketWorkRow = {
  id: string;
  packetId: string;
  lotNumber: string;
  sampleId: string;
  packetStatus: string;
  dispatchState: string;
  blocker: string;
  jobRefId: string;
  lotRefId: string;
};

type DispatchPrepRow = {
  id: string;
  jobNumber: string;
  lotNumber: string;
  coaStatus: string;
  pendingDocs: string;
  dispatchReadiness: string;
  jobRefId: string;
  lotRefId: string;
};

function lotSummary(job: InspectionJob): string {
  const lots = job.lots ?? [];
  if (lots.length === 0) {
    return "No lots";
  }
  if (lots.length === 1) {
    return lots[0]?.lotNumber ?? "1 lot";
  }
  return `${lots[0]?.lotNumber ?? "Lot"} +${lots.length - 1}`;
}

function sampleStatusText(job: InspectionJob): string {
  const lots = job.lots ?? [];
  if (lots.length === 0) {
    return "Not started";
  }
  const readyCount = lots.filter((lot) => lot.sample?.sampleStatus === "READY_FOR_PACKETING").length;
  if (readyCount === lots.length) {
    return "Ready";
  }
  if (readyCount > 0) {
    return `${readyCount}/${lots.length} ready`;
  }
  return "Pending";
}

export function ProductionWorkspaceHome({
  title,
  subtitle,
  jobsEndpoint,
  createHref,
  detailHref,
  lotHref,
  statusBadge,
  canArchive = false,
  onArchive,
}: ProductionWorkspaceHomeProps) {
  const router = useRouter();
  const [jobs, setJobs] = useState<InspectionJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("all");
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(jobsEndpoint);
      if (!response.ok) {
        throw new Error("Production workspace could not be loaded.");
      }
      const payload = await response.json();
      setJobs(Array.isArray(payload) ? payload : []);
    } catch (loadError) {
      setJobs([]);
      setError(loadError instanceof Error ? loadError.message : "Production workspace could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [jobsEndpoint]);

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const workflow = getJobWorkflowPresentation(job);
      const stageMatches = stage === "all" || workflow.label.toLowerCase() === stage;
      const searchBlob = [
        job.inspectionSerialNumber,
        job.jobReferenceNumber,
        job.clientName,
        job.plantLocation ?? "",
        lotSummary(job),
      ]
        .join(" ")
        .toLowerCase();
      const searchMatches = !search || searchBlob.includes(search.toLowerCase());
      return stageMatches && searchMatches;
    });
  }, [jobs, search, stage]);

  const stageOptions = useMemo(() => {
    const set = new Set<string>();
    for (const job of jobs) {
      set.add(getJobWorkflowPresentation(job).label.toLowerCase());
    }
    return ["all", ...Array.from(set)];
  }, [jobs]);

  const getJobById = useCallback(
    (jobId: string) => filteredJobs.find((job) => job.id === jobId) ?? null,
    [filteredJobs]
  );

  const getLotPacketPath = useCallback(
    (job: InspectionJob, lotId: string) => {
      const base = lotHref(job, lotId);
      const queryIndex = base.indexOf("?");
      if (queryIndex === -1) {
        return `${base}/packet`;
      }
      const path = base.slice(0, queryIndex);
      const query = base.slice(queryIndex);
      return `${path}/packet${query}`;
    },
    [lotHref]
  );

  const pendingInspections = useMemo<PendingInspectionRow[]>(() => {
    const rows: PendingInspectionRow[] = [];
    for (const job of filteredJobs) {
      const workflow = getJobWorkflowPresentation(job);
      if (workflow.stage === "complete" || workflow.stage === "reporting") {
        continue;
      }
      rows.push({
        id: `pending-${job.id}`,
        inspectionId: job.inspectionSerialNumber || job.jobReferenceNumber || "—",
        customer: job.plantLocation ? `${job.clientName} • ${job.plantLocation}` : job.clientName,
        lotRef: lotSummary(job),
        sampleStatus: sampleStatusText(job),
        assignedUser: job.assignedTo?.profile?.displayName || "Unassigned",
        stage: workflow.label,
        nextAction: workflow.nextAction,
        jobRefId: job.id,
        lotRefId: job.lots?.[0]?.id ?? null,
        updatedAt: job.updatedAt,
      });
    }
    return rows.sort((left, right) => Number(new Date(right.updatedAt)) - Number(new Date(left.updatedAt)));
  }, [filteredJobs]);

  const lotsNeedingAction = useMemo<LotActionRow[]>(() => {
    const rows: LotActionRow[] = [];
    for (const job of filteredJobs) {
      for (const lot of job.lots ?? []) {
        const sampleStatus = lot.sample?.sampleStatus ?? "Sample pending";
        const packetStatuses = (lot.sample?.packets ?? []).map((packet) => packet.packetStatus);
        const packetStatus = packetStatuses.length === 0
          ? "No packets"
          : packetStatuses.every((status) => status === "READY")
            ? "Ready"
            : "Pending";

        const blocker = !lot.sample
          ? "Sample not created"
          : lot.sample.sampleStatus !== "READY_FOR_PACKETING"
            ? `Sample status: ${lot.sample.sampleStatus}`
            : packetStatuses.length === 0
              ? "Packets not created"
              : "Needs review";

        if (blocker === "Needs review") {
          continue;
        }

        rows.push({
          id: `lot-${lot.id}`,
          lotNumber: lot.lotNumber,
          materialName: lot.materialName ?? "Material pending",
          sampleStatus,
          packetStatus,
          blocker,
          owner: lot.assignedTo?.profile?.displayName || job.assignedTo?.profile?.displayName || "Unassigned",
          jobRefId: job.id,
          lotRefId: lot.id,
        });
      }
    }
    return rows;
  }, [filteredJobs]);

  const packetPendingWork = useMemo<PacketWorkRow[]>(() => {
    const rows: PacketWorkRow[] = [];
    for (const job of filteredJobs) {
      for (const lot of job.lots ?? []) {
        const sample = lot.sample;
        for (const packet of sample?.packets ?? []) {
          const dispatchState = packet.allocation?.allocationStatus ?? "BLOCKED";
          const blocker = dispatchState === "BLOCKED"
            ? "Allocation blocked"
            : packet.packetStatus === "READY"
              ? "Ready"
              : "Packet not ready";

          if (blocker === "Ready") {
            continue;
          }

          rows.push({
            id: `packet-${packet.id}`,
            packetId: packet.packetCode,
            lotNumber: lot.lotNumber,
            sampleId: sample?.sampleCode ?? "—",
            packetStatus: packet.packetStatus,
            dispatchState,
            blocker,
            jobRefId: job.id,
            lotRefId: lot.id,
          });
        }
      }
    }
    return rows;
  }, [filteredJobs]);

  const dispatchPrep = useMemo<DispatchPrepRow[]>(() => {
    const rows: DispatchPrepRow[] = [];
    for (const job of filteredJobs) {
      const hasCoa = (job.reportSnapshots?.length ?? 0) > 0;
      for (const lot of job.lots ?? []) {
        const packets = lot.sample?.packets ?? [];
        const blockedPackets = packets.filter((packet) => (packet.allocation?.allocationStatus ?? "BLOCKED") === "BLOCKED").length;
        const pendingDocs = hasCoa ? (blockedPackets > 0 ? `${blockedPackets} packet docs` : "Complete") : "COA missing";
        const dispatchReadiness = !hasCoa
          ? "Blocked"
          : blockedPackets > 0
            ? "Pending"
            : packets.length > 0
              ? "Ready"
              : "No packets";

        if (dispatchReadiness === "Ready") {
          continue;
        }

        rows.push({
          id: `dispatch-${job.id}-${lot.id}`,
          jobNumber: job.inspectionSerialNumber || job.jobReferenceNumber || "—",
          lotNumber: lot.lotNumber,
          coaStatus: hasCoa ? "Available" : "Missing",
          pendingDocs,
          dispatchReadiness,
          jobRefId: job.id,
          lotRefId: lot.id,
        });
      }
    }
    return rows;
  }, [filteredJobs]);

  return (
    <VStack align="stretch" spacing={4}>
      <PageIdentityBar
        title={title}
        subtitle={subtitle}
        status={
          <HStack spacing={2}>
            {statusBadge ? <Badge colorScheme="brand" variant="subtle">{statusBadge}</Badge> : null}
            <Badge colorScheme="gray" variant="subtle">{filteredJobs.length} jobs</Badge>
          </HStack>
        }
      />

      <PageActionBar
        primaryAction={<Button onClick={() => router.push(createHref)}>Create Job</Button>}
        secondaryActions={<Text fontSize="sm" color="text.secondary">Action-first production workspace</Text>}
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
        search={
          <Input
            placeholder="Search inspection, customer, lot, plant"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            size="sm"
            maxW={{ base: "full", lg: "320px" }}
          />
        }
        actions={<Button size="sm" variant="outline" onClick={() => { setSearch(""); setStage("all"); }}>Clear</Button>}
      />

      {loading ? <PageSkeleton cards={2} rows={3} /> : null}
      {!loading && error ? <InlineErrorState title="Production workspace unavailable" description={error} onRetry={() => void fetchJobs()} /> : null}

      {!loading && !error ? (
        <VStack align="stretch" spacing={5}>
          <VStack align="stretch" spacing={2}>
            <HStack justify="space-between">
              <Text fontWeight="semibold">Pending inspections</Text>
              <Badge variant="subtle">{pendingInspections.length}</Badge>
            </HStack>
            <EnterpriseStickyTable>
              <Box p={3}>
                <EnterpriseDataTable
                  rows={pendingInspections}
                  rowKey={(row) => row.id}
                  emptyLabel="No pending inspections."
                  columns={[
                    { id: "inspection", header: "Inspection ID", render: (row) => row.inspectionId },
                    { id: "customer", header: "Customer / Plant", render: (row) => row.customer },
                    { id: "lot", header: "Lot Number", render: (row) => row.lotRef },
                    { id: "sample", header: "Sample Status", render: (row) => row.sampleStatus },
                    { id: "user", header: "Assigned User", render: (row) => row.assignedUser },
                    { id: "stage", header: "Current Stage", render: (row) => row.stage },
                    {
                      id: "action",
                      header: "Primary Action",
                      render: (row) => {
                        const job = getJobById(row.jobRefId);
                        if (!job) return "—";
                        return (
                          <Button size="sm" onClick={() => router.push(detailHref(job))}>
                            {row.nextAction}
                          </Button>
                        );
                      },
                    },
                  ]}
                  rowActions={[
                    {
                      id: "open-inspection",
                      label: "Open Inspection",
                      onClick: (row) => {
                        const job = getJobById(row.jobRefId);
                        if (job) router.push(detailHref(job));
                      },
                    },
                    {
                      id: "open-lot",
                      label: "Open Lot",
                      onClick: (row) => {
                        const job = getJobById(row.jobRefId);
                        if (!job) return;
                        if (row.lotRefId) {
                          router.push(lotHref(job, row.lotRefId));
                          return;
                        }
                        router.push(detailHref(job));
                      },
                    },
                    { id: "open-docs", label: "Open Documents", onClick: (row) => router.push(`/documents?job=${row.inspectionId}`) },
                    {
                      id: "open-traceability",
                      label: "Open Traceability",
                      onClick: (row) => {
                        if (row.lotRefId) {
                          router.push(`/traceability/lot/${row.lotRefId}`);
                        }
                      },
                      isDisabled: (row) => !row.lotRefId,
                    },
                    ...(canArchive && onArchive
                      ? [{
                          id: "archive",
                          label: archivingId ? "Archiving..." : "Archive",
                          onClick: async (row: PendingInspectionRow) => {
                            if (archivingId) return;
                            const job = filteredJobs.find((item) => item.id === row.jobRefId);
                            if (!job) return;
                            setArchivingId(job.id);
                            try {
                              await onArchive(job);
                              await fetchJobs();
                            } finally {
                              setArchivingId(null);
                            }
                          },
                          isDisabled: () => Boolean(archivingId),
                        }]
                      : []),
                  ]}
                />
              </Box>
            </EnterpriseStickyTable>
          </VStack>

          <VStack align="stretch" spacing={2}>
            <HStack justify="space-between">
              <Text fontWeight="semibold">Lots needing action</Text>
              <Badge variant="subtle">{lotsNeedingAction.length}</Badge>
            </HStack>
            <EnterpriseStickyTable>
              <Box p={3}>
                <EnterpriseDataTable
                  rows={lotsNeedingAction}
                  rowKey={(row) => row.id}
                  emptyLabel="No lots need immediate action."
                  columns={[
                    { id: "lot", header: "Lot Number", render: (row) => row.lotNumber },
                    { id: "material", header: "Material", render: (row) => row.materialName },
                    { id: "sample", header: "Sample Status", render: (row) => row.sampleStatus },
                    { id: "packet", header: "Packet State", render: (row) => row.packetStatus },
                    { id: "blocker", header: "Pending Action", render: (row) => row.blocker },
                    { id: "owner", header: "Owner", render: (row) => row.owner },
                  ]}
                  rowActions={[
                    {
                      id: "open-lot",
                      label: "Open Lot",
                      onClick: (row) => {
                        const job = getJobById(row.jobRefId);
                        if (job) router.push(lotHref(job, row.lotRefId));
                      },
                    },
                    {
                      id: "open-inspection",
                      label: "Open Inspection",
                      onClick: (row) => {
                        const job = getJobById(row.jobRefId);
                        if (job) router.push(detailHref(job));
                      },
                    },
                    { id: "open-docs", label: "Open Documents", onClick: (row) => router.push(`/documents?lot=${row.lotNumber}`) },
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

          <VStack align="stretch" spacing={2}>
            <HStack justify="space-between">
              <Text fontWeight="semibold">Packet-related pending work</Text>
              <Badge variant="subtle">{packetPendingWork.length}</Badge>
            </HStack>
            <EnterpriseStickyTable>
              <Box p={3}>
                <EnterpriseDataTable
                  rows={packetPendingWork}
                  rowKey={(row) => row.id}
                  emptyLabel="No packet-related pending work."
                  columns={[
                    { id: "packet", header: "Packet ID", render: (row) => row.packetId },
                    { id: "lot", header: "Lot Number", render: (row) => row.lotNumber },
                    { id: "sample", header: "Sample ID", render: (row) => row.sampleId },
                    { id: "packetStatus", header: "Packet Status", render: (row) => row.packetStatus },
                    { id: "dispatch", header: "Dispatch State", render: (row) => row.dispatchState },
                    { id: "blocker", header: "Pending Action", render: (row) => row.blocker },
                  ]}
                  rowActions={[
                    {
                      id: "open-packet",
                      label: "Open Packet",
                      onClick: (row) => {
                        const job = getJobById(row.jobRefId);
                        if (!job) return;
                        router.push(getLotPacketPath(job, row.lotRefId));
                      },
                    },
                    {
                      id: "open-lot",
                      label: "Open Lot",
                      onClick: (row) => {
                        const job = getJobById(row.jobRefId);
                        if (job) router.push(lotHref(job, row.lotRefId));
                      },
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

          <VStack align="stretch" spacing={2}>
            <HStack justify="space-between">
              <Text fontWeight="semibold">Dispatch preparation items</Text>
              <Badge variant="subtle">{dispatchPrep.length}</Badge>
            </HStack>
            <EnterpriseStickyTable>
              <Box p={3}>
                <EnterpriseDataTable
                  rows={dispatchPrep}
                  rowKey={(row) => row.id}
                  emptyLabel="No dispatch preparation blockers."
                  columns={[
                    { id: "job", header: "Job Number", render: (row) => row.jobNumber },
                    { id: "lot", header: "Lot Number", render: (row) => row.lotNumber },
                    { id: "coa", header: "COA", render: (row) => row.coaStatus },
                    { id: "docs", header: "Missing Documents", render: (row) => row.pendingDocs },
                    { id: "ready", header: "Dispatch Readiness", render: (row) => row.dispatchReadiness },
                  ]}
                  rowActions={[
                    { id: "open-documents", label: "Open Documents", onClick: (row) => router.push(`/documents?job=${row.jobNumber}&lot=${row.lotNumber}`) },
                    {
                      id: "open-packet",
                      label: "Open Packet",
                      onClick: (row) => {
                        const job = getJobById(row.jobRefId);
                        if (!job) return;
                        router.push(getLotPacketPath(job, row.lotRefId));
                      },
                    },
                    {
                      id: "open-inspection",
                      label: "Open Inspection",
                      onClick: (row) => {
                        const job = getJobById(row.jobRefId);
                        if (job) router.push(detailHref(job));
                      },
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

          {pendingInspections.length + lotsNeedingAction.length + packetPendingWork.length + dispatchPrep.length === 0 ? (
            <EmptyWorkState title="No production actions" description="All monitored queues are currently clear." />
          ) : null}
        </VStack>
      ) : null}
    </VStack>
  );
}
