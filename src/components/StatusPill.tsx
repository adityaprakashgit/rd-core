import { WorkflowStateChip } from "@/components/enterprise/WorkflowStateChip";

/**
 * @deprecated Use WorkflowStateChip directly. Kept as a compatibility wrapper
 * during Wave 1/2 status presentation migration.
 */
export function StatusPill({ status }: { status: string }) {
  return <WorkflowStateChip status={status} />;
}
