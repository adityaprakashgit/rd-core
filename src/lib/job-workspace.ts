import { Prisma } from "@prisma/client";

const publicUserSelect = {
  select: {
    profile: {
      select: {
        displayName: true,
        companyName: true,
        avatarUrl: true,
        jobTitle: true,
      },
    },
    role: true,
  },
} as const;

export const workspaceJobSelect = {
  id: true,
  inspectionSerialNumber: true,
  jobReferenceNumber: true,
  clientName: true,
  commodity: true,
  plantLocation: true,
  status: true,
  assignedAt: true,
  createdAt: true,
  updatedAt: true,
  assignedTo: publicUserSelect,
  assignedBy: publicUserSelect,
  createdByUser: publicUserSelect,
  lots: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      lotNumber: true,
      totalBags: true,
      status: true,
      assignedAt: true,
      assignedTo: publicUserSelect,
      assignedBy: publicUserSelect,
      sampling: {
        select: {
          id: true,
          status: true,
          assignedAt: true,
          beforePhotoUrl: true,
          duringPhotoUrl: true,
          afterPhotoUrl: true,
          assignedTo: publicUserSelect,
          assignedBy: publicUserSelect,
        },
      },
    },
  },
  reportSnapshots: {
    orderBy: { createdAt: "desc" },
    take: 1,
    select: {
      id: true,
      createdAt: true,
    },
  },
} satisfies Prisma.InspectionJobSelect;

export const workspaceJobSummarySelect = {
  id: true,
  inspectionSerialNumber: true,
  jobReferenceNumber: true,
  clientName: true,
  commodity: true,
  plantLocation: true,
  status: true,
  assignedAt: true,
  createdAt: true,
  updatedAt: true,
  assignedTo: publicUserSelect,
  assignedBy: publicUserSelect,
  createdByUser: publicUserSelect,
  lots: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      lotNumber: true,
      totalBags: true,
      sampling: {
        select: {
          id: true,
          beforePhotoUrl: true,
          duringPhotoUrl: true,
          afterPhotoUrl: true,
        },
      },
    },
  },
} satisfies Prisma.InspectionJobSelect;

export const workspaceAssigneeSelect = {
  profile: {
    select: {
      displayName: true,
      companyName: true,
      avatarUrl: true,
      jobTitle: true,
    },
  },
  role: true,
} satisfies Prisma.UserSelect;

export function formatDisplayName(
  user: { profile: { displayName: string } | null } | null | undefined,
  fallback: string
): string {
  return user?.profile?.displayName ?? fallback;
}
