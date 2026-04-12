export type NormalizedDocumentStatus = "Available" | "Active" | "Superseded" | "Missing" | "Current for Dispatch";

export function normalizeDocumentStatus(rawStatus: string | null | undefined, hasDocument: boolean): NormalizedDocumentStatus {
  if (!hasDocument) {
    return "Missing";
  }

  const normalized = (rawStatus ?? "").trim().toLowerCase();
  if (normalized === "current for dispatch") {
    return "Current for Dispatch";
  }
  if (normalized === "active report" || normalized === "active coa" || normalized === "active") {
    return "Active";
  }
  if (normalized === "previous report" || normalized === "superseded") {
    return "Superseded";
  }
  return "Available";
}

export function documentStatusPriority(status: NormalizedDocumentStatus): number {
  switch (status) {
    case "Current for Dispatch":
      return 50;
    case "Active":
      return 40;
    case "Available":
      return 30;
    case "Superseded":
      return 20;
    case "Missing":
      return 10;
    default:
      return 0;
  }
}
