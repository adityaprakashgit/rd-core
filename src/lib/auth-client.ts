export type AuthSession = {
  userId: string;
  companyId: string;
  role: "ADMIN" | "OPERATIONS" | "RND" | "VIEWER";
  email: string;
};

const STORAGE_KEY = "erp_auth";

export function getStoredAuth(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (!parsed.userId || !parsed.companyId || !parsed.role || !parsed.email) {
      return null;
    }
    return {
      userId: parsed.userId,
      companyId: parsed.companyId,
      role: parsed.role,
      email: parsed.email,
    };
  } catch {
    return null;
  }
}

export function setStoredAuth(session: AuthSession): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredAuth(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}

export function getStorageKey(): string {
  return STORAGE_KEY;
}
