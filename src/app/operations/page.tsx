"use client";

import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import { ProductionWorkspaceHome } from "@/components/home/ProductionWorkspaceHome";

export default function OperationsPage() {
  return (
    <ControlTowerLayout>
      <ProductionWorkspaceHome
        title="Production Workspace"
        subtitle="Pending inspections, lot blockers, packet actions, and dispatch preparation."
        jobsEndpoint="/api/jobs?view=all"
        createHref="/rd"
        detailHref={(job) => `/operations/job/${job.id}`}
        lotHref={(job, lotId) => `/operations/job/${job.id}/lot/${lotId}`}
        statusBadge="Production"
      />
    </ControlTowerLayout>
  );
}
