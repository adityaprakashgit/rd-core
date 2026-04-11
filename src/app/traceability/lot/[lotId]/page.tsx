"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Grid,
  GridItem,
  HStack,
  Link,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useParams } from "next/navigation";

import { EnterpriseDataTable } from "@/components/enterprise/EnterpriseDataTable";
import {
  EnterpriseEmptyState,
  HistoryTimeline,
  LinkedRecordsPanel,
  PageActionBar,
  PageIdentityBar,
} from "@/components/enterprise/EnterprisePatterns";
import { WorkflowStateChip } from "@/components/enterprise/WorkflowStateChip";
import ControlTowerLayout from "@/components/layout/ControlTowerLayout";

type TraceabilityPayload = {
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
    };
    previous: Array<{
      snapshotId: string;
      rndJobNumber: string;
      generatedAt: string;
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

function toDateText(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export default function LotTraceabilityPage() {
  const params = useParams<{ lotId: string }>();
  const lotId = params?.lotId;

  const [data, setData] = useState<TraceabilityPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lotId) {
      return;
    }

    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/traceability/lot/${encodeURIComponent(lotId)}`);
        if (!response.ok) {
          const payload = await response.json().catch(() => null) as { details?: string } | null;
          throw new Error(payload?.details || "Failed to load lot traceability.");
        }
        const payload = await response.json() as TraceabilityPayload;
        if (active) {
          setData(payload);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load lot traceability.");
          setData(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [lotId]);

  const linkedItems = useMemo(() => {
    if (!data) {
      return [];
    }
    return [
      { label: "Job Number", value: data.lot.jobNumber, href: `/operations/job/${data.lot.jobId}` },
      { label: "Job Ref", value: data.lot.jobReferenceNumber },
      { label: "Lot Number", value: data.lot.lotNumber, href: `/operations/job/${data.lot.jobId}/lot/${data.lot.id}` },
      { label: "Current Stage", value: data.lot.currentStep },
      { label: "Status", value: data.lot.status },
      { label: "Client", value: data.lot.clientName },
    ];
  }, [data]);

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={5}>
        <PageIdentityBar
          title={data ? `Lot Traceability - ${data.lot.lotNumber}` : "Lot Traceability"}
          subtitle="Inspection -> Samples -> R&D tests -> Packets -> Dispatches -> COA -> Documents -> Audit"
          breadcrumbs={[
            { label: "Inspection", href: "/operations" },
            { label: "Lot Traceability" },
          ]}
          status={
            data ? (
              <HStack spacing={2}>
                <WorkflowStateChip status={data.lot.currentStep} />
                <WorkflowStateChip status={data.coa.available ? "COA_AVAILABLE" : "COA_PENDING"} />
              </HStack>
            ) : null
          }
        />

        <PageActionBar
          secondaryActions={
            <HStack spacing={2}>
              <Button as={Link} href={data ? `/operations/job/${data.lot.jobId}` : "#"} isDisabled={!data} variant="outline" size="sm">
                Open Job
              </Button>
              <Button as={Link} href={data ? `/documents?lot=${data.lot.lotNumber}` : "#"} isDisabled={!data} variant="outline" size="sm">
                Open Documents
              </Button>
            </HStack>
          }
          primaryAction={
            <Button as={Link} href={data ? `/documents?lot=${data.lot.lotNumber}` : "#"} isDisabled={!data} size="sm">
              View PDF
            </Button>
          }
        />

        {loading ? (
          <Box borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface" p={4}><Text color="text.secondary">Loading traceability...</Text></Box>
        ) : null}

        {error ? (
          <EnterpriseEmptyState title="Traceability unavailable" description={error} />
        ) : null}

        {data ? (
          <Grid templateColumns={{ base: "1fr", xl: "minmax(0,1fr) 320px" }} gap={5}>
            <GridItem>
              <VStack align="stretch" spacing={4}>
                <Box borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface" p={4}>
                    <Text fontSize="sm" color="text.secondary" mb={3}>Inspection</Text>
                    <EnterpriseDataTable
                      rows={data.inspection}
                      rowKey={(row) => row.id}
                      columns={[
                        { id: "status", header: "Status", render: (row) => row.status },
                        { id: "decision", header: "Decision", render: (row) => row.decision },
                        { id: "issues", header: "Issue Count", render: (row) => row.issueCount },
                        { id: "started", header: "Started", render: (row) => toDateText(row.startedAt) },
                        { id: "completed", header: "Completed", render: (row) => toDateText(row.completedAt) },
                      ]}
                      emptyLabel="No inspection record yet."
                    />
                  </Box>

                <Box borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface" p={4}>
                    <Text fontSize="sm" color="text.secondary" mb={3}>Samples</Text>
                    <EnterpriseDataTable
                      rows={data.samples}
                      rowKey={(row) => row.id}
                      columns={[
                        { id: "sampleCode", header: "Sample ID", render: (row) => row.sampleCode },
                        { id: "status", header: "Status", render: (row) => row.status },
                        { id: "type", header: "Type", render: (row) => row.sampleType ?? "—" },
                        { id: "date", header: "Sampling Date", render: (row) => toDateText(row.samplingDate) },
                        { id: "remarks", header: "Remarks", render: (row) => row.remarks ?? "—" },
                      ]}
                      emptyLabel="No sample linked to this lot."
                    />
                  </Box>

                <Box borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface" p={4}>
                    <Text fontSize="sm" color="text.secondary" mb={3}>R&D tests</Text>
                    <EnterpriseDataTable
                      rows={data.rdTests}
                      rowKey={(row) => row.id}
                      columns={[
                        { id: "trial", header: "Trial", render: (row) => `#${row.trialNumber}` },
                        { id: "measurements", header: "Readings", render: (row) => row.measurementCount },
                        { id: "createdAt", header: "Created", render: (row) => toDateText(row.createdAt) },
                        { id: "notes", header: "Notes", render: (row) => row.notes ?? "—" },
                      ]}
                      emptyLabel="No R&D trials linked yet."
                    />
                  </Box>

                <Box borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface" p={4}>
                    <Text fontSize="sm" color="text.secondary" mb={3}>Packets</Text>
                    <EnterpriseDataTable
                      rows={data.packets}
                      rowKey={(row) => row.id}
                      columns={[
                        { id: "packetCode", header: "Packet ID", render: (row) => row.packetCode },
                        { id: "status", header: "Status", render: (row) => row.status },
                        { id: "quantity", header: "Quantity", render: (row) => (row.quantity ? `${row.quantity} ${row.unit ?? ""}`.trim() : "—") },
                        { id: "allocation", header: "Dispatch state", render: (row) => row.allocationStatus ?? "—" },
                        { id: "readyAt", header: "Ready At", render: (row) => toDateText(row.readyAt) },
                      ]}
                      emptyLabel="No packets linked to this lot."
                    />
                  </Box>

                <Box borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface" p={4}>
                    <Text fontSize="sm" color="text.secondary" mb={3}>Dispatches</Text>
                    <EnterpriseDataTable
                      rows={data.dispatches}
                      rowKey={(row) => row.id}
                      columns={[
                        { id: "packetCode", header: "Packet ID", render: (row) => row.packetCode },
                        { id: "state", header: "Dispatch State", render: (row) => row.dispatchState },
                        { id: "blocker", header: "Blocker", render: (row) => row.blockingReason ?? "—" },
                      ]}
                      emptyLabel="No dispatch-ready packets yet."
                    />
                  </Box>

                <Box borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface" p={4}>
                    <Text fontSize="sm" color="text.secondary" mb={3}>Certificate of Analysis</Text>
                    <HStack justify="space-between" flexWrap="wrap" spacing={3}>
                      <WorkflowStateChip status={data.coa.available ? "COA_AVAILABLE" : "COA_PENDING"} />
                      <Badge variant="subtle" colorScheme={data.reports.active.snapshotId ? "green" : "gray"}>
                        {data.reports.active.snapshotId ? "Active Report" : "No Active Report"}
                      </Badge>
                      <Text fontSize="sm" color="text.secondary">
                        Previous Reports: {data.reports.previous.length}
                      </Text>
                      <Text fontSize="sm" color="text.secondary">Generated: {toDateText(data.coa.generatedAt)}</Text>
                      <Button as={Link} href={data.coa.latestSnapshotId ? `/api/report/${data.coa.latestSnapshotId}` : "#"} isDisabled={!data.coa.latestSnapshotId} size="sm" variant="outline">
                        View PDF
                      </Button>
                    </HStack>
                  </Box>

                <Box borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface" p={4}>
                    <Text fontSize="sm" color="text.secondary" mb={3}>Related documents</Text>
                    <EnterpriseDataTable
                      rows={data.relatedDocuments}
                      rowKey={(row) => row.id}
                      columns={[
                        { id: "type", header: "Type", render: (row) => row.type },
                        { id: "label", header: "Document", render: (row) => row.label },
                        { id: "status", header: "Status", render: (row) => row.status },
                        { id: "created", header: "Created", render: (row) => toDateText(row.createdAt) },
                        {
                          id: "action",
                          header: "Action",
                          render: (row) => row.url ? <Link href={row.url} target="_blank" color="brand.600">View PDF</Link> : "Not Available",
                        },
                      ]}
                      emptyLabel="No related documents found."
                    />
                  </Box>

                <Box borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface" p={4}>
                    <Text fontSize="sm" color="text.secondary" mb={3}>Audit timeline</Text>
                    <HistoryTimeline
                      events={data.auditTimeline.map((event) => ({
                        id: event.id,
                        title: `${event.entity}: ${event.action}`,
                        subtitle: event.note ?? `By ${event.by}`,
                        at: toDateText(event.at),
                      }))}
                    />
                  </Box>
              </VStack>
            </GridItem>

            <GridItem>
              <Stack spacing={4} position={{ xl: "sticky" }} top={{ xl: "96px" }}>
                <LinkedRecordsPanel items={linkedItems} />
                <Box borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface" p={4}>
                    <VStack align="stretch" spacing={2}>
                      <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">Lifecycle</Text>
                      {[
                        "Inspection",
                        "Samples",
                        "R&D tests",
                        "Packets",
                        "Dispatches",
                        "Certificate of Analysis",
                        "Related documents",
                        "Audit timeline",
                      ].map((step) => (
                        <HStack key={step} justify="space-between">
                          <Text fontSize="sm">{step}</Text>
                          <Badge variant="subtle" colorScheme="gray">Visible</Badge>
                        </HStack>
                      ))}
                    </VStack>
                  </Box>
              </Stack>
            </GridItem>
          </Grid>
        ) : null}
      </VStack>
    </ControlTowerLayout>
  );
}
