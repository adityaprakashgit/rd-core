"use client";

import { RecordRouteRedirect } from "@/components/navigation/RecordRouteRedirect";

export default function LotDetailPage({ params }: { params: { lotId: string } }) {
  return (
    <RecordRouteRedirect
      endpoint={`/api/lots/${params.lotId}`}
      title="Lot detail"
      buildHref={(payload) => `/jobs/${payload.jobId}/workflow?lotId=${payload.id}&section=lots`}
    />
  );
}
