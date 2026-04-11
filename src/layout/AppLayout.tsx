"use client";

import { Box, Center, Spinner } from "@chakra-ui/react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Header } from "@/layout/Header";
import { MobileBottomNav } from "@/layout/MobileBottomNav";
import { Sidebar } from "@/layout/Sidebar";
import { useWorkspaceView } from "@/context/WorkspaceViewContext";
import { clearStoredAuth, getStoredAuth } from "@/lib/auth-client";
import { MOBILE_CONTENT_BOTTOM_PADDING } from "@/lib/mobile-bottom-ui";
import { normalizeRole, type NormalizedRole } from "@/lib/role";
import { CLIENT_AUTH_BYPASS_ENABLED } from "@/lib/runtime-flags";
import {
  GLOBAL_SEARCH_PLACEHOLDER,
  resolveBreadcrumbs,
  resolvePageDefinition,
} from "@/lib/ui-navigation";

type SessionPayload = {
  role: string;
  email: string | null;
  profile: {
    displayName: string;
    companyName: string | null;
    jobTitle: string | null;
    avatarUrl: string | null;
  } | null;
};

const ROLE_VIEW_HOME_MAP: Record<NormalizedRole, string> = {
  ADMIN: "/admin",
  OPERATIONS: "/userinsp",
  RND: "/rnd",
  VIEWER: "/exceptions",
};

export function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { viewMode, setViewMode } = useWorkspaceView();

  const [session, setSession] = useState<SessionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [roleViewOverride, setRoleViewOverride] = useState<NormalizedRole | null>(null);

  const loadSession = useCallback(async () => {
    setLoading(true);
    try {
      const auth = getStoredAuth();
      const headers = auth
        ? {
            "x-user-id": auth.userId,
            "x-company-id": auth.companyId,
            "x-user-role": auth.role,
          }
        : undefined;
      const response = await fetch("/api/session/me", { headers });
      if (!response.ok) {
        throw new Error("Session unavailable");
      }
      const data: SessionPayload = await response.json();
      setSession(data);
    } catch {
      setSession(null);
      if (CLIENT_AUTH_BYPASS_ENABLED) {
        return;
      }
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    const view = new URL(window.location.href).searchParams.get("view") === "all" ? "all" : "my";
    setViewMode(view);
  }, [pathname, setViewMode]);

  useEffect(() => {
    const persisted = window.localStorage.getItem("enterprise-nav-collapsed");
    setIsSidebarCollapsed(persisted === "1");
  }, []);

  useEffect(() => {
    const persistedRoleView = window.localStorage.getItem("enterprise-role-view");
    const normalized = normalizeRole(persistedRoleView);
    setRoleViewOverride(normalized);
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("auth-viewport-lock");
    document.body.classList.add("auth-viewport-lock");
    return () => {
      document.documentElement.classList.remove("auth-viewport-lock");
      document.body.classList.remove("auth-viewport-lock");
    };
  }, []);

  const onViewModeChange = useCallback(
    (nextView: "my" | "all") => {
      setViewMode(nextView);
      router.push(nextView === "all" ? `${pathname}?view=all` : pathname);
    },
    [pathname, router, setViewMode]
  );

  const onRoleViewChange = useCallback(
    (nextRole: NormalizedRole) => {
      if (!session) {
        return;
      }
      const baseRole = normalizeRole(session.role);
      const nextOverride = baseRole === nextRole ? null : nextRole;
      setRoleViewOverride(nextOverride);
      if (nextOverride) {
        window.localStorage.setItem("enterprise-role-view", nextOverride);
      } else {
        window.localStorage.removeItem("enterprise-role-view");
      }
      if (nextRole !== "ADMIN") {
        setViewMode("my");
      }
      const destination = ROLE_VIEW_HOME_MAP[nextRole];
      router.push(destination);
    },
    [router, session, setViewMode],
  );

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // noop: UI logout should still continue.
    }

    clearStoredAuth();

    router.push("/login");
  }, [router]);

  const handleToggleCollapse = useCallback(() => {
    setIsSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("enterprise-nav-collapsed", next ? "1" : "0");
      return next;
    });
  }, []);

  if (loading) {
    return (
      <Center minH="100vh">
        <Spinner color="brand.500" size="xl" />
      </Center>
    );
  }

  if (!session) {
    return (
      <Center minH="100vh">
        <Spinner color="brand.500" size="xl" />
      </Center>
    );
  }

  const displayName = session.profile?.displayName ?? "Current User";
  const companyName = session.profile?.companyName ?? "Company";
  const baseRole = normalizeRole(session.role);
  const effectiveRole = roleViewOverride ?? baseRole;
  const pageDefinition = resolvePageDefinition(pathname);
  const breadcrumbs = resolveBreadcrumbs(pageDefinition, pathname);
  const canSwitchRoleView = baseRole === "ADMIN";

  return (
    <Box h="100dvh" bg="bg.app" overflow="hidden">
      <Box display={{ base: "none", lg: "block" }} position="fixed" insetY={0} left={0} zIndex={20}>
        <Sidebar
          role={effectiveRole ?? session.role}
          companyName={companyName}
          displayName={displayName}
          onLogout={handleLogout}
          collapsed={isSidebarCollapsed}
          onToggleCollapse={handleToggleCollapse}
        />
      </Box>

      <Box ml={{ base: 0, lg: isSidebarCollapsed ? 18 : 60 }} h="100dvh" transition="margin-left 180ms ease" overflow="hidden">
        <Header
          role={effectiveRole ?? session.role}
          displayName={displayName}
          companyName={companyName}
          onLogout={handleLogout}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          canSwitchRoleView={canSwitchRoleView}
          onRoleViewChange={onRoleViewChange}
          page={pageDefinition}
          breadcrumbs={breadcrumbs}
          searchPlaceholder={GLOBAL_SEARCH_PLACEHOLDER}
        />

        <Box
          px={{ base: 3, md: 5, lg: 6 }}
          py={{ base: 3, md: 4, lg: 5 }}
          pb={{ base: MOBILE_CONTENT_BOTTOM_PADDING, lg: 8 }}
          maxW="7xl"
          mx="auto"
          h={{ base: "calc(100dvh - 72px)", md: "calc(100dvh - 76px)", lg: "calc(100dvh - 80px)" }}
          overflowY="auto"
          overflowX="hidden"
        >
          {children}
        </Box>
      </Box>

      <MobileBottomNav
        role={effectiveRole}
        displayName={displayName}
        companyName={companyName}
        pathname={pathname}
        onLogout={handleLogout}
      />
    </Box>
  );
}
