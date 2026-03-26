export type Role = "ADMIN" | "OPERATIONS" | "RND" | "VIEWER" | "RD" | "LAB" | "Inspector" | null;

export type NormalizedRole = "ADMIN" | "OPERATIONS" | "RND" | "VIEWER";

const ROLE_MAP: Record<string, NormalizedRole> = {
  ADMIN: "ADMIN",
  OPERATIONS: "OPERATIONS",
  INSPECTOR: "OPERATIONS",
  RND: "RND",
  RD: "RND",
  LAB: "RND",
  VIEWER: "VIEWER",
};

export function normalizeRole(role: string | null | undefined): NormalizedRole | null {
  if (!role) {
    return null;
  }

  const normalized = ROLE_MAP[role.toUpperCase()];
  return normalized ?? null;
}

export const ROLE_VALUES: NormalizedRole[] = ["ADMIN", "OPERATIONS", "RND", "VIEWER"];
