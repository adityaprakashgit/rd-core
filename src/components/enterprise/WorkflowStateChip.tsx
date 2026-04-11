import { Badge } from "@chakra-ui/react";

import { getStatusPresentation } from "@/lib/status-presentation";

export function WorkflowStateChip({
  status,
}: {
  status: string | null | undefined;
}) {
  const presentation = getStatusPresentation(status);
  return (
    <Badge colorScheme={presentation.tone} variant="subtle" px={2} py={0.5} borderRadius="md" fontSize="xs">
      {presentation.label}
    </Badge>
  );
}
