"use client";

import { RecordRouteRedirect } from "@/components/navigation/RecordRouteRedirect";

export default function LotDetailPage({ params }: { params: { lotId: string } }) {
  return (
    <RecordRouteRedirect
      endpoint={`/api/lots/${params.lotId}`}
      title="Lot detail"
      buildHref={(payload) => `/traceability/lots/${payload.id}`}
    />
  );
}
