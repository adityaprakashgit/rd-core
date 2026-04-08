import { Badge } from "@chakra-ui/react";

const STATUS_THEME: Record<string, { color: string; bg: string }> = {
  COMPLETED: { color: "status.success.text", bg: "status.success.bg" },
  SUCCESS: { color: "status.success.text", bg: "status.success.bg" },
  READY: { color: "status.success.text", bg: "status.success.bg" },
  READY_FOR_SAMPLING: { color: "status.success.text", bg: "status.success.bg" },
  IN_PROGRESS: { color: "status.warning.text", bg: "status.warning.bg" },
  INSPECTION_IN_PROGRESS: { color: "status.warning.text", bg: "status.warning.bg" },
  ON_HOLD: { color: "status.warning.text", bg: "status.warning.bg" },
  PENDING: { color: "status.warning.text", bg: "status.warning.bg" },
  ERROR: { color: "status.error.text", bg: "status.error.bg" },
  FAILED: { color: "status.error.text", bg: "status.error.bg" },
  REJECTED: { color: "status.error.text", bg: "status.error.bg" },
  INFO: { color: "status.info.text", bg: "status.info.bg" },
};

export function StatusPill({ status }: { status: string }) {
  const key = status.toUpperCase();
  const theme = STATUS_THEME[key] ?? STATUS_THEME.INFO;

  return (
    <Badge borderRadius="full" px={2.5} py={1} fontSize="xs" color={theme.color} bg={theme.bg} textTransform="uppercase">
      {status.replaceAll("_", " ")}
    </Badge>
  );
}
