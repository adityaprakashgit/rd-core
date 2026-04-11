import React from "react";
import { AuditLog } from "@/types/inspection";
import { HistoryTimeline } from "@/components/enterprise/EnterprisePatterns";

interface AuditTrailProps {
  logs: AuditLog[];
}

function actorName(log: AuditLog): string {
  return log.user?.profile?.displayName ?? "System";
}

/**
 * @deprecated Use HistoryTimeline directly. Retained as a compatibility wrapper
 * during timeline family consolidation.
 */
export const AuditTrail: React.FC<AuditTrailProps> = ({ logs }) => {
  return (
    <HistoryTimeline
      events={logs.map((log) => ({
        id: log.id,
        title: log.entity ? `${log.entity} · ${log.action}` : log.action,
        subtitle: `${log.notes || "System trace entry"} · ${actorName(log)}`,
        at: new Date(log.createdAt).toLocaleString(),
      }))}
    />
  );
};
