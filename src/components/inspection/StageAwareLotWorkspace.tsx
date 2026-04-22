"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { InlineErrorState, PageSkeleton } from "@/components/enterprise/AsyncState";
import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import { LotInspectionWorkspace } from "@/components/inspection/LotInspectionWorkspace";
import { SampleManagementWorkspace } from "@/components/inspection/SampleManagementWorkspace";
import { getInspectionSamplingDisplayStatus } from "@/lib/sample-management";

type InspectionExecutionProbe = {
  inspection: {
    inspectionStatus?: string | null;
    decisionStatus?: string | null;
  } | null;
};

export function StageAwareLotWorkspace({
  backHref,
}: {
  backHref: (jobId: string, viewMode: string) => string;
}) {
  const { jobId, lotId } = useParams<{ jobId: string; lotId: string }>();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isReadyForSampling, setIsReadyForSampling] = useState(false);
  const forcedStage = searchParams.get("stage");

  const probeStage = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const res = await fetch(`/api/inspection/execution?lotId=${lotId}&jobId=${jobId}`);
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { details?: string } | null;
        throw new Error(payload?.details ?? "Failed to resolve lot stage.");
      }

      const payload = (await res.json()) as InspectionExecutionProbe;
      setIsReadyForSampling(getInspectionSamplingDisplayStatus(payload.inspection) === "READY_FOR_SAMPLING");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to resolve lot stage.";
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, [jobId, lotId]);

  useEffect(() => {
    void probeStage();
  }, [forcedStage, probeStage]);

  if (loading) {
    return (
      <ControlTowerLayout>
        <PageSkeleton cards={3} rows={3} />
      </ControlTowerLayout>
    );
  }

  if (loadError) {
    return (
      <ControlTowerLayout>
        <InlineErrorState title="Lot workspace unavailable" description={loadError} onRetry={() => void probeStage()} />
      </ControlTowerLayout>
    );
  }

  return isReadyForSampling ? (
    <SampleManagementWorkspace backHref={backHref} />
  ) : (
    <LotInspectionWorkspace backHref={backHref} />
  );
}
