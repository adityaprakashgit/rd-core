"use client";

import { JobIntakeWorkspace } from "@/components/inspection/JobIntakeWorkspace";
import { useWorkspaceView } from "@/context/WorkspaceViewContext";

export default function UserInspectionJobPage() {
  const { viewMode } = useWorkspaceView();

  return (
    <JobIntakeWorkspace
      jobsEndpoint={`/api/jobs?view=${viewMode}`}
      backHref="/userinsp"
      lotHref={(currentJobId, lotId) => `/userinsp/job/${currentJobId}/lot/${lotId}?view=${viewMode}`}
      viewVariant="queue"
    />
  );
}
