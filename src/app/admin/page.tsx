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
  Stack,
  Text,
  useToast,
} from "@chakra-ui/react";
import { useRouter } from "next/navigation";

import { Card } from "@/components/Card";
import { EnterpriseDataTable } from "@/components/enterprise/EnterpriseDataTable";
import { ConfigurationPageTemplate, MobileActionRail } from "@/components/enterprise/PageTemplates";
import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import type { TableColumn } from "@/types/ui-table";

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

function formatDate(value: string) {
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

export default function AdminPage() {
  const router = useRouter();
  const toast = useToast();

  const [rows, setRows] = useState<EscalationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [activeEscalation, setActiveEscalation] = useState<EscalationRow | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadEscalations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) {
        params.set("status", statusFilter);
      }
      if (typeFilter) {
        params.set("type", typeFilter);
      }
      params.set("page", "1");
      params.set("pageSize", "50");

      const response = await fetch(`/api/admin/workflow-escalations?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Unable to load escalation queue");
      }

      const payload = await response.json() as { rows?: EscalationRow[] };
      setRows(Array.isArray(payload.rows) ? payload.rows : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load escalation queue.";
      setRows([]);
      toast({ title: "Escalation queue unavailable", description: message, status: "error" });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, toast]);

  useEffect(() => {
    void loadEscalations();
  }, [loadEscalations]);

  const columns = useMemo<TableColumn<EscalationRow>[]>(
    () => [
      {
        id: "createdAt",
        header: "Created",
        render: (row) => formatDate(row.createdAt),
      },
      {
        id: "type",
        header: "Type",
        render: (row) => row.type,
      },
      {
        id: "severity",
        header: "Severity",
        render: (row) => <Badge colorScheme={severityColor(row.severity)}>{row.severity}</Badge>,
      },
      {
        id: "status",
        header: "Status",
        render: (row) => <Badge colorScheme={statusColor(row.status)}>{row.status}</Badge>,
      },
      {
        id: "jobLot",
        header: "Job/Lot",
        render: (row) => [row.jobId ?? "-", row.lotId ?? "-"].join(" / "),
      },
      {
        id: "raisedBy",
        header: "Raised By",
        render: (row) => row.raisedByUser?.profile?.displayName ?? row.raisedByUser?.email ?? "-",
      },
      {
        id: "title",
        header: "Title",
        render: (row) => row.title,
      },
    ],
    [],
  );

  async function updateEscalationStatus(id: string, status: "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED", note?: string) {
    setUpdatingId(id);
    try {
      const response = await fetch(`/api/admin/workflow-escalations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          resolutionNote: note,
        }),
      });

      if (!response.ok) {
        throw new Error("Status update failed");
      }

      toast({
        title: "Escalation updated",
        description: `Escalation moved to ${status}.`,
        status: "success",
      });
      await loadEscalations();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update escalation.";
      toast({ title: "Update failed", description: message, status: "error" });
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <ControlTowerLayout>
      <Stack spacing={6}>
        <HStack justify="end" spacing={3} display={{ base: "none", md: "flex" }}>
          <Button onClick={() => router.push("/master")}>Open Reference Data</Button>
          <Button variant="outline" onClick={() => router.push("/settings")}>Open Workspace Configuration</Button>
        </HStack>

        <ConfigurationPageTemplate
          sections={[
            {
              id: "access",
              title: "Access Governance",
              description: "Role-driven module and action visibility for enterprise-grade least privilege.",
              content: (
                <Card>
                  <Box>
                    <Text fontSize="sm" color="text.secondary">Access Model</Text>
                    <Text fontSize="2xl" fontWeight="bold">Role-Governed</Text>
                  </Box>
                </Card>
              ),
            },
            {
              id: "security",
              title: "Security Enforcement",
              description: "Validation at both UI and API boundaries for resilient enterprise operations.",
              content: (
                <Card>
                  <Box>
                    <Text fontSize="sm" color="text.secondary">Security Posture</Text>
                    <Text fontSize="2xl" fontWeight="bold">Backend-Enforced</Text>
                  </Box>
                </Card>
              ),
            },
            {
              id: "escalations",
              title: "Escalation Queue",
              description: "Operational escalation stream for duplicate warnings, lot conflicts, and policy blocks.",
              content: (
                <Stack spacing={4}>
                  <HStack spacing={3} flexWrap="wrap">
                    <FormControl maxW="240px">
                      <FormLabel>Status</FormLabel>
                      <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                        <option value="">All</option>
                        <option value="OPEN">OPEN</option>
                        <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
                        <option value="RESOLVED">RESOLVED</option>
                        <option value="DISMISSED">DISMISSED</option>
                      </Select>
                    </FormControl>
                    <FormControl maxW="320px">
                      <FormLabel>Type</FormLabel>
                      <Select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                        <option value="">All</option>
                        <option value="DUPLICATE_JOB">DUPLICATE_JOB</option>
                        <option value="LOT_CONFLICT">LOT_CONFLICT</option>
                        <option value="VALIDATION_ERROR">VALIDATION_ERROR</option>
                        <option value="PACKING_POLICY_BLOCK">PACKING_POLICY_BLOCK</option>
                        <option value="AUDIT_LOG_FAILURE">AUDIT_LOG_FAILURE</option>
                        <option value="OPERATIONAL_BLOCK">OPERATIONAL_BLOCK</option>
                      </Select>
                    </FormControl>
                    <Button onClick={() => void loadEscalations()} isLoading={loading}>Refresh</Button>
                  </HStack>

                  <EnterpriseDataTable
                    rows={rows}
                    columns={columns}
                    rowKey={(row) => row.id}
                    filters={[
                      { id: "status", label: "Status", value: statusFilter || "All" },
                      { id: "type", label: "Type", value: typeFilter || "All" },
                    ]}
                    emptyLabel={loading ? "Loading escalation queue..." : "No escalations found."}
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
                    recordCard={{
                      title: (row) => row.title,
                      subtitle: (row) => `${row.type} • ${row.status}`,
                      fields: [
                        { id: "severity", label: "Severity", render: (row) => row.severity },
                        { id: "created", label: "Created", render: (row) => formatDate(row.createdAt) },
                        { id: "scope", label: "Job/Lot", render: (row) => [row.jobId ?? "-", row.lotId ?? "-"].join(" / ") },
                      ],
                    }}
                  />
                </Stack>
              ),
            },
            {
              id: "quick-access",
              title: "Operational Shortcuts",
              description: "Direct links to high-frequency governance and execution destinations.",
              content: (
                <HStack mt={1} spacing={3} flexWrap="wrap">
                  <Button onClick={() => router.push("/userinsp")}>Open Control Center</Button>
                  <Button onClick={() => router.push("/operations")}>Open Execution</Button>
                  <Button onClick={() => router.push("/userrd")}>Open Lab & Analysis</Button>
                  <Button onClick={() => router.push("/reports")}>Open Documents & Reports</Button>
                </HStack>
              ),
            },
          ]}
        />

        <MobileActionRail>
          <Button flex="1" onClick={() => router.push("/master")}>Reference Data</Button>
          <Button flex="1" variant="outline" onClick={() => router.push("/settings")}>Workspace Config</Button>
        </MobileActionRail>
      </Stack>

      <Modal isOpen={activeEscalation !== null} onClose={() => setActiveEscalation(null)} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Resolve Escalation</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={3}>
              <Text fontSize="sm" color="text.secondary">
                Add a resolution note before moving this escalation to RESOLVED.
              </Text>
              <FormControl isRequired>
                <FormLabel>Resolution Note</FormLabel>
                <Input
                  value={resolutionNote}
                  onChange={(event) => setResolutionNote(event.target.value)}
                  placeholder="What action resolved this issue?"
                />
              </FormControl>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => setActiveEscalation(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!activeEscalation || !resolutionNote.trim()) {
                  return;
                }
                void updateEscalationStatus(activeEscalation.id, "RESOLVED", resolutionNote.trim());
                setActiveEscalation(null);
              }}
            >
              Resolve
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </ControlTowerLayout>
  );
}
