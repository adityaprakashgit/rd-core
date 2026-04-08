"use client";

import { RecordRouteRedirect } from "@/components/navigation/RecordRouteRedirect";

export default function SampleDetailPage({ params }: { params: { sampleId: string } }) {
  return (
    <RecordRouteRedirect
      endpoint={`/api/samples/${params.sampleId}`}
      title="Sample detail"
      buildHref={(payload) => `/jobs/${payload.jobId}/workflow?lotId=${payload.lotId}&section=sampling`}
    />
  );
}
