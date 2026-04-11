export type StatusTone = "gray" | "blue" | "orange" | "purple" | "green" | "red" | "yellow";

export type StatusPresentation = {
  label: string;
  tone: StatusTone;
};

const JOB_STATUS_PRESENTATION: Record<string, StatusPresentation> = {
  SUCCESS: { label: "Success", tone: "green" },
  ERROR: { label: "Error", tone: "red" },
  WARNING: { label: "Warning", tone: "orange" },
  INFO: { label: "Info", tone: "blue" },
  PENDING: { label: "Pending", tone: "gray" },
  IN_PROGRESS: { label: "In Progress", tone: "orange" },
  SAMPLING_PENDING: { label: "Sampling Pending", tone: "orange" },
  SAMPLING_IN_PROGRESS: { label: "Sampling In Progress", tone: "orange" },
  QA: { label: "QA", tone: "blue" },
  RND_RUNNING: { label: "R&D Running", tone: "purple" },
  REPORT_READY: { label: "Report Ready", tone: "green" },
  LOCKED: { label: "Locked", tone: "green" },
  COMPLETED: { label: "Completed", tone: "green" },
  DISPATCHED: { label: "Dispatched", tone: "green" },
  READY_FOR_SAMPLING: { label: "Ready for Sampling", tone: "green" },
  ON_HOLD: { label: "On Hold", tone: "yellow" },
  REJECTED: { label: "Rejected", tone: "red" },
  CREATED: { label: "Created", tone: "gray" },
  DETAILS_CAPTURED: { label: "Details Captured", tone: "gray" },
  MEDIA_PENDING: { label: "Media Pending", tone: "orange" },
  SAMPLING_CAPTURED: { label: "Sampling Captured", tone: "orange" },
  READY_FOR_NEXT_STAGE: { label: "Ready", tone: "green" },
  READY_TO_INSPECT: { label: "Ready to Inspect", tone: "green" },
  INSPECTION_IN_PROGRESS: { label: "Inspection In Progress", tone: "orange" },
  READY_FOR_PACKETING: { label: "Ready for Packeting", tone: "green" },
  HOMOGENIZED: { label: "Homogenized", tone: "purple" },
  AVAILABLE: { label: "Available", tone: "green" },
  ALLOCATED: { label: "Allocated", tone: "purple" },
  RESERVED: { label: "Reserved", tone: "orange" },
  USED: { label: "Used", tone: "gray" },
  SEALED: { label: "Sealed", tone: "blue" },
  LABELED: { label: "Labeled", tone: "blue" },
  BLOCKED: { label: "Blocked", tone: "red" },
  ON_TRACK: { label: "On Track", tone: "green" },
  DUE_SOON: { label: "Due Soon", tone: "orange" },
  OVERDUE: { label: "Overdue", tone: "red" },
  HIGH: { label: "High", tone: "red" },
  MEDIUM: { label: "Medium", tone: "orange" },
  LOW: { label: "Low", tone: "gray" },
  COA_AVAILABLE: { label: "COA Available", tone: "green" },
  COA_PENDING: { label: "COA Pending", tone: "orange" },
  PREVIEW_READY: { label: "Preview Ready", tone: "green" },
  PREVIEW_PENDING: { label: "Preview Pending", tone: "gray" },
  SEAL_VALID: { label: "Seal Format Valid", tone: "green" },
  SEAL_INVALID: { label: "Seal Must Be 16 Digits", tone: "orange" },
  SEAL_AUTO: { label: "Auto Generated", tone: "blue" },
  SEAL_MANUAL: { label: "Scanned / Manual", tone: "gray" },
  INTAKE: { label: "Intake", tone: "gray" },
  LOT_CAPTURE: { label: "Lot Intake", tone: "gray" },
  SAMPLING: { label: "Sampling", tone: "orange" },
  LAB: { label: "Lab Running", tone: "purple" },
  REPORTING: { label: "Report Ready", tone: "green" },
  COMPLETE: { label: "Completed", tone: "green" },
  READY_FOR_TEST_SETUP: { label: "Ready for Setup", tone: "orange" },
  READY_FOR_TESTING: { label: "Ready for Testing", tone: "purple" },
  IN_TESTING: { label: "In Testing", tone: "purple" },
  AWAITING_REVIEW: { label: "Awaiting Review", tone: "blue" },
  APPROVED: { label: "Approved", tone: "green" },
  REWORK_REQUIRED: { label: "Rework Required", tone: "red" },
  PENDING_INTAKE: { label: "Pending Intake", tone: "gray" },
  READY_FOR_SETUP: { label: "Ready for Setup", tone: "orange" },
};

export function getStatusPresentation(input: string | null | undefined): StatusPresentation {
  const normalized = (input ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/gu, "_");
  if (!normalized) {
    return { label: "Not Available", tone: "gray" };
  }
  const mapped = JOB_STATUS_PRESENTATION[normalized];
  if (mapped) {
    return mapped;
  }
  return {
    label: normalized.replaceAll("_", " "),
    tone: "gray",
  };
}
