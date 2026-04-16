"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, HStack, Input, Select, Text, VStack } from "@chakra-ui/react";
import { useRouter } from "next/navigation";

import { EmptyWorkState, InlineErrorState, PageSkeleton } from "@/components/enterprise/AsyncState";
import { EnterpriseDataTable } from "@/components/enterprise/EnterpriseDataTable";
import { WorkflowStateChip } from "@/components/enterprise/WorkflowStateChip";
import { EnterpriseStickyTable, FilterSearchStrip, PageActionBar, PageIdentityBar } from "@/components/enterprise/EnterprisePatterns";
import ControlTowerLayout from "@/components/layout/ControlTowerLayout";

type RndQueueRow = {
  id: string;
  rndJobNumber: string;
  parentJobNumber: string;
  sampleId: string;
  packetId: string;
  packetWeight: string;
  packetUse: string;
  receivedDate: string;
  assignedUser: string;
  priority: string;
  dueStatus: string;
  currentStep: string;
  primaryAction: string;
  bucket: "PENDING_INTAKE" | "READY_FOR_SETUP" | "IN_TESTING" | "AWAITING_REVIEW" | "COMPLETED";
};

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
}

const BUCKET_OPTIONS = [
  { id: "all", label: "All Buckets" },
  { id: "PENDING_INTAKE", label: "Pending Intake" },
  { id: "READY_FOR_SETUP", label: "Ready for Setup" },
  { id: "IN_TESTING", label: "In Testing" },
  { id: "AWAITING_REVIEW", label: "Awaiting Review" },
  { id: "COMPLETED", label: "Completed" },
] as const;

export default function RndQueuePage() {
  const router = useRouter();
  const [rows, setRows] = useState<RndQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [bucket, setBucket] = useState<(typeof BUCKET_OPTIONS)[number]["id"]>("all");
  const [priority, setPriority] = useState("all");

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qp = new URLSearchParams();
      if (bucket !== "all") qp.set("bucket", bucket);
      if (priority !== "all") qp.set("priority", priority);
      const response = await fetch(`/api/rnd/jobs?${qp.toString()}`);
      if (!response.ok) {
        throw new Error("R&D queue could not be loaded.");
      }
      const payload = (await response.json()) as {
        rows: Array<Record<string, unknown>>;
      };
      const mapped: RndQueueRow[] = (payload.rows ?? []).map((row) => ({
        id: String(row.id ?? ""),
        rndJobNumber: String(row.rndJobNumber ?? "-"),
        parentJobNumber: String((row.parentJob as { inspectionSerialNumber?: string } | null)?.inspectionSerialNumber ?? "-"),
        sampleId: String((row.sample as { sampleCode?: string } | null)?.sampleCode ?? "-"),
        packetId: String((row.packet as { packetCode?: string } | null)?.packetCode ?? "-"),
        packetWeight: (() => {
          const packet = row.packet as { packetWeight?: number | null; packetUnit?: string | null } | null;
          return packet?.packetWeight ? `${packet.packetWeight} ${packet.packetUnit ?? ""}`.trim() : "-";
        })(),
        packetUse: String(row.packetUse ?? "-"),
        receivedDate: formatDate(String(row.receivedAt ?? "")),
        assignedUser: String((row.assignedTo as { profile?: { displayName?: string } } | null)?.profile?.displayName ?? "Unassigned"),
        priority: String(row.priority ?? "MEDIUM"),
        dueStatus: String(row.dueStatus ?? "ON_TRACK"),
        currentStep: String(row.currentStep ?? "-"),
        primaryAction: String(row.primaryAction ?? "Open Job"),
        bucket: String(row.bucket ?? "PENDING_INTAKE") as RndQueueRow["bucket"],
      }));
      setRows(mapped);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "R&D queue could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [bucket, priority]);

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (!search) return true;
      return [
        row.rndJobNumber,
        row.parentJobNumber,
        row.sampleId,
        row.packetId,
        row.packetUse,
        row.assignedUser,
        row.priority,
        row.currentStep,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase());
    });
  }, [rows, search]);

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={4}>
        <PageIdentityBar
          title="R&D Queue"
          subtitle="Queue-first workspace for intake, setup, testing, review, and completion."
          status={
            <HStack spacing={2}>
              <Badge colorScheme="purple" variant="subtle">
                R&D
              </Badge>
              <Badge colorScheme="gray" variant="subtle">
                {rows.length} jobs
              </Badge>
            </HStack>
          }
        />

        <PageActionBar
          primaryAction={<Button onClick={() => router.push("/rnd/history")}>View History</Button>}
          secondaryActions={<Text fontSize="sm" color="text.secondary">Queue → Open Job → Test → Review → Done</Text>}
        />

        <FilterSearchStrip
          filters={
            <HStack spacing={2}>
              <Select size="sm" maxW="220px" value={bucket} onChange={(event) => setBucket(event.target.value as typeof bucket)}>
                {BUCKET_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Select size="sm" maxW="180px" value={priority} onChange={(event) => setPriority(event.target.value)}>
                <option value="all">All Priority</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </Select>
            </HStack>
          }
          search={
            <Input
              size="sm"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search job, sample, packet, test, assignee"
              maxW={{ base: "full", md: "320px" }}
            />
          }
          actions={
            <Button size="sm" variant="outline" onClick={() => { setSearch(""); setBucket("all"); setPriority("all"); }}>
              Clear
            </Button>
          }
        />

        {loading ? <PageSkeleton cards={2} rows={2} /> : null}
        {!loading && error ? <InlineErrorState title="R&D queue unavailable" description={error} onRetry={() => void fetchQueue()} /> : null}
        {!loading && !error ? (
          filtered.length === 0 ? (
            <EmptyWorkState title="No R&D jobs found" description="Try changing filters or search." />
          ) : (
            <EnterpriseStickyTable>
              <EnterpriseDataTable
                rows={filtered}
                rowKey={(row) => row.id}
                columns={[
                  { id: "rnd", header: "R&D Job Number", render: (row) => row.rndJobNumber },
                  { id: "parent", header: "Parent Job Number", render: (row) => row.parentJobNumber },
                  { id: "sample", header: "Sample ID", render: (row) => row.sampleId },
                  { id: "packet", header: "Packet ID", render: (row) => row.packetId },
                  { id: "weight", header: "Packet Weight", render: (row) => row.packetWeight },
                  { id: "use", header: "Packet Use", render: (row) => row.packetUse },
                  { id: "received", header: "Received Date", render: (row) => row.receivedDate },
                  { id: "assigned", header: "Assigned User", render: (row) => row.assignedUser },
                  { id: "priority", header: "Priority", render: (row) => <WorkflowStateChip status={row.priority} /> },
                  { id: "due", header: "Due Status", render: (row) => <WorkflowStateChip status={row.dueStatus} /> },
                  { id: "step", header: "Current Step", render: (row) => row.currentStep },
                  {
                    id: "action",
                    header: "Primary Action",
                    render: (row) => (
                      <Button size="xs" onClick={() => router.push(`/rnd/jobs/${row.id}`)}>
                        {row.primaryAction}
                      </Button>
                    ),
                  },
                ]}
              />
            </EnterpriseStickyTable>
          )
        ) : null}
      </VStack>
    </ControlTowerLayout>
  );
}
