"use client";

import { RecordRouteRedirect } from "@/components/navigation/RecordRouteRedirect";

export default function PacketDetailPage({ params }: { params: { packetId: string } }) {
  return (
    <RecordRouteRedirect
      endpoint={`/api/packets/${params.packetId}`}
      title="Packet detail"
      buildHref={(payload) => `/jobs/${payload.jobId}/workflow?lotId=${payload.lotId}&section=packets`}
    />
  );
}
