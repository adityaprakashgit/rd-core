"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, HStack, Text, VStack } from "@chakra-ui/react";
import { useRouter } from "next/navigation";

import { EmptyWorkState, InlineErrorState, PageSkeleton } from "@/components/enterprise/AsyncState";
import { EnterpriseDataTable } from "@/components/enterprise/EnterpriseDataTable";
import { PageIdentityBar } from "@/components/enterprise/EnterprisePatterns";
import { WorkflowStateChip } from "@/components/enterprise/WorkflowStateChip";
import ControlTowerLayout from "@/components/layout/ControlTowerLayout";

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
}

type HistoryRow = {
  id: string;
  rndJobNumber: string;
  status: string;
  parentJobNumber: string;
  lotNumber: string;
  packetId: string;
  previousRndJob: string;
  nextRetests: number;
  completedAt: string;
};

export default function RndHistoryPage() {
  const router = useRouter();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/rnd/history");
      if (!response.ok) throw new Error("R&D history could not be loaded.");
      const payload = (await response.json()) as Array<Record<string, unknown>>;
      setRows(
        payload.map((entry) => ({
          id: String(entry.id ?? ""),
          rndJobNumber: String(entry.rndJobNumber ?? "-"),
          status: String(entry.status ?? "-"),
          parentJobNumber: String((entry.parentJob as { inspectionSerialNumber?: string } | null)?.inspectionSerialNumber ?? "-"),
          lotNumber: String((entry.lot as { lotNumber?: string } | null)?.lotNumber ?? "-"),
          packetId: String((entry.packet as { packetCode?: string } | null)?.packetCode ?? "-"),
          previousRndJob: String((entry.previousRndJob as { rndJobNumber?: string } | null)?.rndJobNumber ?? "-"),
          nextRetests: (entry.nextRetestJobs as Array<unknown> | undefined)?.length ?? 0,
          completedAt: formatDate(String(entry.completedAt ?? entry.updatedAt ?? "")),
        })),
      );
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "R&D history could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={4}>
        <PageIdentityBar
          title="R&D History"
          subtitle="Completed and approved cycles with retest lineage."
          status={<Text fontSize="sm" color="text.secondary">{rows.length} historical jobs</Text>}
          right={
            <HStack>
              <Button variant="outline" onClick={() => router.push("/rnd")}>Back to Queue</Button>
            </HStack>
          }
        />

        {loading ? <PageSkeleton cards={2} rows={2} /> : null}
        {!loading && error ? <InlineErrorState title="R&D history unavailable" description={error} onRetry={() => void fetchHistory()} /> : null}
        {!loading && !error ? (
          rows.length === 0 ? (
            <EmptyWorkState title="No completed R&D jobs" description="Completed jobs and retests will appear here." />
          ) : (
            <EnterpriseDataTable
              rows={rows}
              rowKey={(row) => row.id}
              columns={[
                { id: "rnd", header: "R&D Job", render: (row) => row.rndJobNumber },
                { id: "status", header: "Status", render: (row) => <WorkflowStateChip status={row.status} /> },
                { id: "parent", header: "Parent Job", render: (row) => row.parentJobNumber },
                { id: "lot", header: "Lot", render: (row) => row.lotNumber },
                { id: "packet", header: "Packet", render: (row) => row.packetId },
                { id: "prev", header: "Previous R&D Job", render: (row) => row.previousRndJob },
                { id: "retests", header: "Retests", render: (row) => String(row.nextRetests) },
                { id: "completed", header: "Completed At", render: (row) => row.completedAt },
                {
                  id: "action",
                  header: "Action",
                  render: (row) => (
                    <Button size="xs" onClick={() => router.push(`/rnd/jobs/${row.id}`)}>
                      Open
                    </Button>
                  ),
                },
              ]}
            />
          )
        ) : null}
      </VStack>
    </ControlTowerLayout>
  );
}
