"use client";

import { StageAwareLotWorkspace } from "@/components/inspection/StageAwareLotWorkspace";

export default function LotDetailPage() {
  return (
    <StageAwareLotWorkspace
      backHref={(jobId) => `/operations/job/${jobId}`}
    />
  );
}
