"use client";

import { useCallback } from "react";
import { useToast } from "@chakra-ui/react";

import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import { ProductionWorkspaceHome } from "@/components/home/ProductionWorkspaceHome";
import { useWorkspaceView } from "@/context/WorkspaceViewContext";
import { getStoredAuth } from "@/lib/auth-client";
import type { InspectionJob } from "@/types/inspection";

export default function UserInspDashboard() {
  const toast = useToast();
  const { viewMode } = useWorkspaceView();
  const role = getStoredAuth()?.role ?? null;
  const canArchive = role === "ADMIN" || role === "OPERATIONS";

  const archiveJob = useCallback(
    async (job: InspectionJob) => {
      const response = await fetch(`/api/jobs/${job.id}/archive`, { method: "POST" });
      const payload = (await response.json().catch(() => null)) as { details?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.details ?? "Archive failed.");
      }
      toast({ title: "Job archived", status: "success" });
    },
    [toast],
  );

  return (
    <ControlTowerLayout>
      <ProductionWorkspaceHome
        title="Production Workspace"
        subtitle={viewMode === "all" ? "Company-wide pending work across inspections, lots, packets, and dispatch." : "My assigned production queues and pending actions."}
        jobsEndpoint={`/api/jobs?view=${viewMode}`}
        createHref="/rd"
        detailHref={(job) => `/userinsp/job/${job.id}?view=${viewMode}`}
        lotHref={(job, lotId) => `/userinsp/job/${job.id}/lot/${lotId}?view=${viewMode}`}
        statusBadge={viewMode === "all" ? "Production (Company)" : "Production (My Tasks)"}
        canArchive={canArchive}
        onArchive={archiveJob}
      />
    </ControlTowerLayout>
  );
}
