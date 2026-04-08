"use client";

import { JobIntakeWorkspace } from "@/components/inspection/JobIntakeWorkspace";

export default function OperationsJobPage() {
  return (
    <JobIntakeWorkspace
      jobsEndpoint="/api/jobs?view=all"
      backHref="/operations"
      lotHref={(jobId, lotId) => `/operations/job/${jobId}/lot/${lotId}`}
    />
  );
}
