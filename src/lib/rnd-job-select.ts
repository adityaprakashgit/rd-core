import type { Prisma } from "@prisma/client";

const publicUserSelect = {
  select: {
    id: true,
    email: true,
    role: true,
    profile: {
      select: {
        displayName: true,
        companyName: true,
        avatarUrl: true,
        jobTitle: true,
      },
    },
  },
} as const;

export const rndJobListSelect = {
  id: true,
  rndJobNumber: true,
  companyId: true,
  parentJobId: true,
  lotId: true,
  sampleId: true,
  packetId: true,
  previousRndJobId: true,
  status: true,
  resultPrecedence: true,
  jobType: true,
  packetUse: true,
  testType: true,
  priority: true,
  deadline: true,
  receivedAt: true,
  createdAt: true,
  updatedAt: true,
  assignedToId: true,
  approverUserId: true,
  assignedTo: publicUserSelect,
  approverUser: publicUserSelect,
  parentJob: {
    select: {
      id: true,
      inspectionSerialNumber: true,
      jobReferenceNumber: true,
      handedOverToRndTo: true,
      status: true,
      createdAt: true,
    },
  },
  lot: {
    select: {
      id: true,
      lotNumber: true,
      materialName: true,
      createdAt: true,
    },
  },
  sample: {
    select: {
      id: true,
      sampleCode: true,
      sampleType: true,
      sampleStatus: true,
      createdAt: true,
    },
  },
  packet: {
    select: {
      id: true,
      packetCode: true,
      packetStatus: true,
      packetQuantity: true,
      packetWeight: true,
      packetUnit: true,
      packetType: true,
      submittedToRndAt: true,
      createdAt: true,
    },
  },
} satisfies Prisma.RndJobSelect;

export const rndJobDetailSelect = {
  ...rndJobListSelect,
  remarks: true,
  testMethod: true,
  testingStartedAt: true,
  resultsSubmittedAt: true,
  reviewedAt: true,
  completedAt: true,
  readings: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      parameter: true,
      value: true,
      unit: true,
      remarks: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  attachments: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
      mimeType: true,
      fileSizeBytes: true,
      notes: true,
      uploadedById: true,
      createdAt: true,
      updatedAt: true,
      uploadedBy: publicUserSelect,
    },
  },
  reviews: {
    orderBy: { reviewedAt: "desc" },
    select: {
      id: true,
      action: true,
      notes: true,
      reviewedAt: true,
      reviewedById: true,
      reviewedBy: publicUserSelect,
    },
  },
  packetUsageLedgerEntries: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      entryType: true,
      useType: true,
      quantity: true,
      unit: true,
      direction: true,
      notes: true,
      createdById: true,
      createdAt: true,
      createdBy: publicUserSelect,
    },
  },
  previousRndJob: {
    select: {
      id: true,
      rndJobNumber: true,
      status: true,
      resultPrecedence: true,
      jobType: true,
      completedAt: true,
    },
  },
  nextRetestJobs: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      rndJobNumber: true,
      status: true,
      resultPrecedence: true,
      jobType: true,
      createdAt: true,
    },
  },
} satisfies Prisma.RndJobSelect;
