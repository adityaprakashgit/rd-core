import { prisma } from "@/lib/prisma";
import { Role, normalizeRole } from "@/lib/role";
import { AUTH_BYPASS_ENABLED } from "@/lib/runtime-flags";

export type SessionProfile = {
  displayName: string;
  companyName: string | null;
  jobTitle: string | null;
  avatarUrl: string | null;
};

export type CurrentUser = {
  id: string;
  companyId: string;
  role: Exclude<Role, null>;
  email: string | null;
  profile: SessionProfile | null;
};

function toCurrentUser(user: {
  id: string;
  companyId: string;
  role: Exclude<Role, null>;
  email: string | null;
  profile: {
    displayName: string;
    companyName: string | null;
    jobTitle: string | null;
    avatarUrl: string | null;
  } | null;
}): CurrentUser {
  return {
    id: user.id,
    companyId: user.companyId,
    role: user.role,
    email: user.email,
    profile: user.profile
      ? {
          displayName: user.profile.displayName,
          companyName: user.profile.companyName ?? null,
          jobTitle: user.profile.jobTitle ?? null,
          avatarUrl: user.profile.avatarUrl ?? null,
        }
      : null,
  };
}

function readHeader(headers: Headers, key: string): string | null {
  const value = headers.get(key);
  return value && value.trim().length > 0 ? value.trim() : null;
}

async function getBypassUser(): Promise<CurrentUser | null> {
  if (!AUTH_BYPASS_ENABLED) {
    return null;
  }

  const user = await prisma.user.findFirst({
    where: { isActive: true },
    orderBy: [
      { role: "asc" },
      { createdAt: "asc" },
    ],
    select: {
      id: true,
      companyId: true,
      email: true,
      role: true,
      profile: {
        select: {
          displayName: true,
          companyName: true,
          jobTitle: true,
          avatarUrl: true,
        },
      },
    },
  });

  return user ? toCurrentUser(user) : null;
}

export async function getCurrentUserFromHeaders(headers: Headers): Promise<CurrentUser | null> {
  const requestedUserId = readHeader(headers, "x-user-id");
  const requestedCompanyId = readHeader(headers, "x-company-id");
  const requestedRole = normalizeRole(readHeader(headers, "x-user-role"));

  if (!requestedUserId || !requestedCompanyId || !requestedRole) {
    return getBypassUser();
  }

  const userId = requestedUserId;
  const companyId = requestedCompanyId;
  const role = requestedRole;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      companyId: true,
      email: true,
      role: true,
      profile: {
        select: {
          displayName: true,
          companyName: true,
          jobTitle: true,
          avatarUrl: true,
        },
      },
    },
  });

  if (!user) {
    return getBypassUser();
  }

  if (user.companyId !== companyId || user.role !== role) {
    return getBypassUser();
  }

  return toCurrentUser(user);
}

export async function getCurrentUserFromRequest(request: Request): Promise<CurrentUser | null> {
  return getCurrentUserFromHeaders(request.headers);
}

export function requireSessionHeaders(request: Request): Headers {
  return request.headers;
}
