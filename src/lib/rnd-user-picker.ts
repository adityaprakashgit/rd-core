import type { Prisma, PrismaClient, UserRole } from "@prisma/client";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

const userPickerSelect = {
  id: true,
  email: true,
  role: true,
  profile: {
    select: {
      displayName: true,
      jobTitle: true,
    },
  },
} as const;

export type RndUserPickerOption = {
  id: string;
  displayName: string;
  email: string | null;
  role: UserRole;
  jobTitle: string | null;
};

export function toRndUserPickerOption(
  user: Prisma.UserGetPayload<{ select: typeof userPickerSelect }>,
): RndUserPickerOption {
  return {
    id: user.id,
    displayName: user.profile?.displayName ?? user.email ?? user.id,
    email: user.email,
    role: user.role,
    jobTitle: user.profile?.jobTitle ?? null,
  };
}

export async function searchRndUsers(input: {
  prismaClient: PrismaLike;
  companyId: string;
  roles: UserRole[];
  query?: string | null;
  limit?: number;
}) {
  const q = input.query?.trim();
  const rows = await input.prismaClient.user.findMany({
    where: {
      companyId: input.companyId,
      role: { in: input.roles },
      isActive: true,
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" } },
              {
                profile: {
                  displayName: { contains: q, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ profile: { displayName: "asc" } }, { email: "asc" }],
    take: Math.min(Math.max(input.limit ?? 20, 1), 50),
    select: userPickerSelect,
  });

  return rows.map(toRndUserPickerOption);
}

export async function resolveSuggestedRndAssigneeId(input: {
  prismaClient: PrismaLike;
  companyId: string;
  parentJobId: string;
  handoverTargetId?: string | null;
}) {
  const handoverTargetId = input.handoverTargetId?.trim();
  if (handoverTargetId) {
    const handover = await input.prismaClient.user.findFirst({
      where: {
        id: handoverTargetId,
        companyId: input.companyId,
        role: "RND",
        isActive: true,
      },
      select: { id: true },
    });
    if (handover) return handover.id;
  }

  const prior = await input.prismaClient.rndJob.findFirst({
    where: {
      companyId: input.companyId,
      parentJobId: input.parentJobId,
      assignedToId: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: { assignedToId: true },
  });

  return prior?.assignedToId ?? null;
}
