export const EXECUTION_TERMS = {
  batch: {
    singular: "Batch",
    plural: "Batches",
    number: "Batch Number",
    basics: "Batch Basics",
    workflow: "Batch Workflow",
    registry: "Batch Registry",
  },
  bag: {
    singular: "Bag",
    plural: "Bags",
    number: "Bag Number",
    basics: "Bag Basics",
    intake: "Bag Intake",
    details: "Bag Details",
  },
  samplePacket: {
    singular: "Sample packet",
    plural: "Sample packets",
  },
} as const;

export function replaceExecutionTerminology(value: string) {
  return value
    .replaceAll(/\bJob\b/g, "Batch")
    .replaceAll(/\bjob\b/g, "batch")
    .replaceAll(/\bJobs\b/g, "Batches")
    .replaceAll(/\bLot\b/g, "Bag")
    .replaceAll(/\blot\b/g, "bag")
    .replaceAll(/\bLots\b/g, "Bags");
}

