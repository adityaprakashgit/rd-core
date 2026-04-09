"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useRouter } from "next/navigation";

import { EmptyWorkState, InlineErrorState, PageSkeleton } from "@/components/enterprise/AsyncState";
import { EnterpriseDataTable } from "@/components/enterprise/EnterpriseDataTable";
import { EnterpriseStickyTable, FilterSearchStrip, PageActionBar, PageIdentityBar } from "@/components/enterprise/EnterprisePatterns";
import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import { formatHoursDuration, getCurrentMilestoneAgeHours, getCurrentMilestoneStage } from "@/lib/workflow-milestone-display";
import type { InspectionJob } from "@/types/inspection";

type EscalationRow = {
  id: string;
  type: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED";
  title: string;
  jobId: string | null;
  lotId: string | null;
  createdAt: string;
  raisedByUser: {
    id: string;
    email: string | null;
    profile: { displayName: string } | null;
  } | null;
};

type GovernanceRow = {
  id: string;
  queue: string;
  pendingAction: string;
  owner: string;
  link: string;
  priority: string;
};

type MilestoneHealthRow = {
  id: string;
  jobNumber: string;
  currentMilestone: string;
  stageAge: string;
  owner: string;
  nextAction: string;
  link: string;
};

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }
  return parsed.toLocaleString();
}

function severityColor(value: EscalationRow["severity"]) {
  switch (value) {
    case "CRITICAL":
      return "red";
    case "HIGH":
      return "orange";
    case "MEDIUM":
      return "yellow";
    default:
      return "gray";
  }
}

function statusColor(value: EscalationRow["status"]) {
  switch (value) {
    case "RESOLVED":
      return "green";
    case "ACKNOWLEDGED":
      return "blue";
    case "DISMISSED":
      return "gray";
    default:
      return "orange";
  }
}

export default function AdminWorkspacePage() {
  const router = useRouter();
  const toast = useToast();

  const [rows, setRows] = useState<EscalationRow[]>([]);
  const [jobs, setJobs] = useState<InspectionJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [activeEscalation, setActiveEscalation] = useState<EscalationRow | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) {
        params.set("status", statusFilter);
      }
      if (typeFilter) {
        params.set("type", typeFilter);
      }
      params.set("page", "1");
      params.set("pageSize", "100");

      const [escalationsResponse, jobsResponse] = await Promise.all([
        fetch(`/api/admin/workflow-escalations?${params.toString()}`),
        fetch("/api/jobs?view=all"),
      ]);

      if (!escalationsResponse.ok || !jobsResponse.ok) {
        throw new Error("Admin workspace could not be loaded.");
      }

      const escalationPayload = (await escalationsResponse.json()) as { rows?: EscalationRow[] };
      const jobsPayload = (await jobsResponse.json()) as InspectionJob[];

      setRows(Array.isArray(escalationPayload.rows) ? escalationPayload.rows : []);
      setJobs(Array.isArray(jobsPayload) ? jobsPayload : []);
    } catch (loadError) {
      setRows([]);
      setJobs([]);
      setError(loadError instanceof Error ? loadError.message : "Admin workspace could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  async function updateEscalationStatus(id: string, status: "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED", note?: string) {
    setUpdatingId(id);
    try {
      const response = await fetch(`/api/admin/workflow-escalations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, resolutionNote: note }),
      });

      if (!response.ok) {
        throw new Error("Status update failed");
      }

      toast({
        title: "Escalation updated",
        description: `Escalation moved to ${status}.`,
        status: "success",
      });
      await loadWorkspace();
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "Failed to update escalation.";
      toast({ title: "Update failed", description: message, status: "error" });
    } finally {
      setUpdatingId(null);
    }
  }

  const searchText = search.toLowerCase();
  const escalationRows = useMemo(() => {
    return rows.filter((row) => {
      if (!searchText) {
        return true;
      }
      const lookup = [
        row.type,
        row.status,
        row.title,
        row.jobId ?? "",
        row.lotId ?? "",
        row.raisedByUser?.profile?.displayName ?? row.raisedByUser?.email ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return lookup.includes(searchText);
    });
  }, [rows, searchText]);

  const governanceQueues = useMemo(() => {
    const openEscalations = rows.filter((row) => row.status === "OPEN").length;
    const activeJobs = jobs.filter((job) => !["COMPLETED", "DISPATCHED"].includes(job.status)).length;

    const userRoleRows: GovernanceRow[] = [
      {
        id: "user-role-1",
        queue: "User and role management",
        pendingAction: "Review role assignments and access boundaries",
        owner: "Admin",
        link: "/settings",
        priority: openEscalations > 0 ? "High" : "Medium",
      },
    ];

    const masterDataRows: GovernanceRow[] = [
      {
        id: "master-data-1",
        queue: "Master data",
        pendingAction: "Validate client, item, warehouse, transporter records",
        owner: "Admin",
        link: "/master",
        priority: "Medium",
      },
    ];

    const workflowRows: GovernanceRow[] = [
      {
        id: "workflow-1",
        queue: "Workflow configuration",
        pendingAction: "Review checklist and guardrail settings",
        owner: "Admin",
        link: "/settings",
        priority: "High",
      },
    ];

    const auditRows: GovernanceRow[] = jobs
      .slice(0, 8)
      .map((job) => ({
        id: `audit-${job.id}`,
        queue: "Audit logs",
        pendingAction: `Review timeline for ${job.inspectionSerialNumber || job.jobReferenceNumber || "Job"}`,
        owner: job.assignedTo?.profile?.displayName || "Unassigned",
        link: `/jobs/${job.id}/workflow`,
        priority: activeJobs > 0 ? "Medium" : "Low",
      }));

    const documentTemplateRows: GovernanceRow[] = [
      {
        id: "doc-template-1",
        queue: "Document templates",
        pendingAction: "Review report defaults and template branding",
        owner: "Admin",
        link: "/settings",
        priority: "Medium",
      },
    ];

    return {
      userRoleRows,
      masterDataRows,
      workflowRows,
      auditRows,
      documentTemplateRows,
    };
  }, [jobs, rows]);

  const milestoneHealthRows = useMemo<MilestoneHealthRow[]>(() => {
    return jobs
      .filter((job) => !["COMPLETED", "DISPATCHED"].includes(job.status))
      .map((job) => {
        const currentMilestone = getCurrentMilestoneStage(job);
        const stageAge = getCurrentMilestoneAgeHours(job);
        let nextAction = "Open Job Workflow";
        if (currentMilestone === "Job Created") nextAction = "Create first lot";
        if (currentMilestone === "Job Started") nextAction = "Submit for final decision";
        if (currentMilestone === "Sent to Admin") nextAction = "Manager/Admin decision required";
        if (currentMilestone === "Admin Decision") nextAction = "Complete operations workflow";
        if (currentMilestone === "Operations Completed") nextAction = "Submit to R&D";
        return {
          id: job.id,
          jobNumber: job.inspectionSerialNumber || job.jobReferenceNumber || "—",
          currentMilestone,
          stageAge: stageAge === null ? "Pending" : formatHoursDuration(stageAge),
          owner: job.assignedTo?.profile?.displayName || "Unassigned",
          nextAction,
          link: `/jobs/${job.id}/workflow`,
        };
      })
      .sort((left, right) => {
        const leftHours = Number.parseInt(left.stageAge, 10) || 0;
        const rightHours = Number.parseInt(right.stageAge, 10) || 0;
        return rightHours - leftHours;
      });
  }, [jobs]);

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={5}>
        <PageIdentityBar
          title="Admin Workspace"
          subtitle="Governance queues for access, masters, workflow, audit, and document configuration"
          breadcrumbs={[{ label: "Admin", href: "/admin" }]}
          status={
            <HStack spacing={2}>
              <Badge colorScheme="red">Admin</Badge>
              <Badge variant="subtle">{rows.length} escalations</Badge>
            </HStack>
          }
        />

        <PageActionBar
          primaryAction={<Button onClick={() => router.push("/master")}>Open Master Data</Button>}
          secondaryActions={
            <HStack spacing={2}>
              <Button variant="outline" size="sm" onClick={() => router.push("/settings")}>Workflow Configuration</Button>
              <Button variant="outline" size="sm" onClick={() => router.push("/documents")}>Document Registry</Button>
            </HStack>
          }
        />

        <FilterSearchStrip
          filters={
            <HStack spacing={2}>
              <FormControl maxW="220px">
                <FormLabel fontSize="xs" mb={1}>Status</FormLabel>
                <Select size="sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="">All</option>
                  <option value="OPEN">OPEN</option>
                  <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
                  <option value="RESOLVED">RESOLVED</option>
                  <option value="DISMISSED">DISMISSED</option>
                </Select>
              </FormControl>
              <FormControl maxW="260px">
                <FormLabel fontSize="xs" mb={1}>Type</FormLabel>
                <Select size="sm" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                  <option value="">All</option>
                  <option value="DUPLICATE_JOB">DUPLICATE_JOB</option>
                  <option value="LOT_CONFLICT">LOT_CONFLICT</option>
                  <option value="VALIDATION_ERROR">VALIDATION_ERROR</option>
                  <option value="PACKING_POLICY_BLOCK">PACKING_POLICY_BLOCK</option>
                  <option value="AUDIT_LOG_FAILURE">AUDIT_LOG_FAILURE</option>
                  <option value="OPERATIONAL_BLOCK">OPERATIONAL_BLOCK</option>
                </Select>
              </FormControl>
            </HStack>
          }
          search={<Input size="sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search escalations" maxW={{ base: "full", lg: "280px" }} />}
          actions={<Button size="sm" variant="outline" onClick={() => { setSearch(""); void loadWorkspace(); }}>Refresh</Button>}
        />

        {loading ? <PageSkeleton cards={2} rows={3} /> : null}
        {!loading && error ? <InlineErrorState title="Admin workspace unavailable" description={error} onRetry={() => void loadWorkspace()} /> : null}

        {!loading && !error ? (
          <VStack align="stretch" spacing={5}>
            <VStack align="stretch" spacing={2}>
              <HStack justify="space-between">
                <Text fontWeight="semibold">Milestone health</Text>
                <Badge variant="subtle">{milestoneHealthRows.length}</Badge>
              </HStack>
              <EnterpriseStickyTable>
                <Box p={3}>
                  <EnterpriseDataTable
                    rows={milestoneHealthRows}
                    rowKey={(row) => row.id}
                    emptyLabel="No active milestone health items."
                    columns={[
                      { id: "job", header: "Job Number", render: (row) => row.jobNumber },
                      { id: "milestone", header: "Current Milestone", render: (row) => row.currentMilestone },
                      { id: "age", header: "Stage Age", render: (row) => row.stageAge },
                      { id: "owner", header: "Owner", render: (row) => row.owner },
                      { id: "action", header: "Next Action", render: (row) => row.nextAction },
                    ]}
                    rowActions={[
                      {
                        id: "open-job",
                        label: "Open Job Workflow",
                        onClick: (row) => router.push(row.link),
                      },
                    ]}
                  />
                </Box>
              </EnterpriseStickyTable>
            </VStack>

            {[
              { title: "User and role management", rows: governanceQueues.userRoleRows },
              { title: "Master data", rows: governanceQueues.masterDataRows },
              { title: "Workflow configuration", rows: governanceQueues.workflowRows },
              { title: "Audit logs", rows: governanceQueues.auditRows },
              { title: "Document templates", rows: governanceQueues.documentTemplateRows },
            ].map((section) => (
              <VStack key={section.title} align="stretch" spacing={2}>
                <HStack justify="space-between">
                  <Text fontWeight="semibold">{section.title}</Text>
                  <Badge variant="subtle">{section.rows.length}</Badge>
                </HStack>
                <EnterpriseStickyTable>
                  <Box p={3}>
                    <EnterpriseDataTable
                      rows={section.rows}
                      rowKey={(row) => row.id}
                      emptyLabel={`No ${section.title.toLowerCase()} items.`}
                      columns={[
                        { id: "queue", header: "Queue", render: (row) => row.queue },
                        { id: "action", header: "Pending Action", render: (row) => row.pendingAction },
                        { id: "owner", header: "Owner", render: (row) => row.owner },
                        {
                          id: "priority",
                          header: "Priority",
                          render: (row) => (
                            <Badge colorScheme={row.priority === "High" ? "red" : row.priority === "Medium" ? "orange" : "gray"}>
                              {row.priority}
                            </Badge>
                          ),
                        },
                      ]}
                      rowActions={[
                        {
                          id: "open",
                          label: "Open Queue Detail",
                          onClick: (row) => router.push(row.link),
                        },
                      ]}
                    />
                  </Box>
                </EnterpriseStickyTable>
              </VStack>
            ))}

            <VStack align="stretch" spacing={2}>
              <HStack justify="space-between">
                <Text fontWeight="semibold">Escalation queue</Text>
                <Badge variant="subtle">{escalationRows.length}</Badge>
              </HStack>
              <EnterpriseStickyTable>
                <Box p={3}>
                  <EnterpriseDataTable
                    rows={escalationRows}
                    rowKey={(row) => row.id}
                    emptyLabel="No escalations found."
                    columns={[
                      { id: "created", header: "Created", render: (row) => formatDate(row.createdAt) },
                      { id: "type", header: "Type", render: (row) => row.type },
                      { id: "severity", header: "Severity", render: (row) => <Badge colorScheme={severityColor(row.severity)}>{row.severity}</Badge> },
                      { id: "status", header: "Status", render: (row) => <Badge colorScheme={statusColor(row.status)}>{row.status}</Badge> },
                      { id: "scope", header: "Job/Lot", render: (row) => [row.jobId ?? "-", row.lotId ?? "-"].join(" / ") },
                      { id: "owner", header: "Raised By", render: (row) => row.raisedByUser?.profile?.displayName ?? row.raisedByUser?.email ?? "-" },
                      { id: "title", header: "Title", render: (row) => row.title },
                    ]}
                    rowActions={[
                      {
                        id: "ack",
                        label: "Acknowledge",
                        onClick: (row) => void updateEscalationStatus(row.id, "ACKNOWLEDGED"),
                        isDisabled: (row) => row.status !== "OPEN" || updatingId === row.id,
                      },
                      {
                        id: "resolve",
                        label: "Resolve",
                        onClick: (row) => {
                          setActiveEscalation(row);
                          setResolutionNote("");
                        },
                        isDisabled: (row) => row.status === "RESOLVED" || updatingId === row.id,
                      },
                      {
                        id: "dismiss",
                        label: "Dismiss",
                        onClick: (row) => void updateEscalationStatus(row.id, "DISMISSED"),
                        isDisabled: (row) => row.status === "DISMISSED" || updatingId === row.id,
                      },
                    ]}
                  />
                </Box>
              </EnterpriseStickyTable>
            </VStack>

            {governanceQueues.userRoleRows.length + governanceQueues.masterDataRows.length + governanceQueues.workflowRows.length + governanceQueues.auditRows.length + governanceQueues.documentTemplateRows.length + escalationRows.length === 0 ? (
              <EmptyWorkState title="No admin actions" description="All governance queues are currently clear." />
            ) : null}
          </VStack>
        ) : null}

        <Modal isOpen={activeEscalation !== null} onClose={() => setActiveEscalation(null)} isCentered>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Resolve Escalation</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <VStack align="stretch" spacing={3}>
                <Text fontSize="sm" color="text.secondary">{activeEscalation?.title}</Text>
                <FormControl>
                  <FormLabel>Resolution note</FormLabel>
                  <Input
                    value={resolutionNote}
                    onChange={(event) => setResolutionNote(event.target.value)}
                    placeholder="Add a concise resolution note"
                  />
                </FormControl>
              </VStack>
            </ModalBody>
            <ModalFooter>
              <HStack spacing={2}>
                <Button variant="outline" onClick={() => setActiveEscalation(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    if (!activeEscalation) return;
                    await updateEscalationStatus(activeEscalation.id, "RESOLVED", resolutionNote || undefined);
                    setActiveEscalation(null);
                  }}
                  isLoading={Boolean(activeEscalation && updatingId === activeEscalation.id)}
                >
                  Resolve
                </Button>
              </HStack>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </VStack>
    </ControlTowerLayout>
  );
}
