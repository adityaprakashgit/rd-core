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
import { normalizeRole } from "@/lib/role";
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

export function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { viewMode, setViewMode } = useWorkspaceView();

  const [session, setSession] = useState<SessionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
  const pageDefinition = resolvePageDefinition(pathname);
  const breadcrumbs = resolveBreadcrumbs(pageDefinition, pathname);
  const normalizedRole = normalizeRole(session.role);

  return (
    <Box h="100dvh" bg="bg.app" overflow="hidden">
      <Box display={{ base: "none", md: "block" }} position="fixed" insetY={0} left={0} zIndex={20}>
        <Sidebar
          role={session.role}
          companyName={companyName}
          displayName={displayName}
          onLogout={handleLogout}
          collapsed={isSidebarCollapsed}
          onToggleCollapse={handleToggleCollapse}
        />
      </Box>

      <Box ml={{ base: 0, md: isSidebarCollapsed ? 24 : 80 }} h="100dvh" transition="margin-left 180ms ease" overflow="hidden">
        <Header
          role={session.role}
          displayName={displayName}
          companyName={companyName}
          onLogout={handleLogout}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          page={pageDefinition}
          breadcrumbs={breadcrumbs}
          searchPlaceholder={GLOBAL_SEARCH_PLACEHOLDER}
        />

        <Box
          px={{ base: 4, md: 8 }}
          py={{ base: 4, md: 6 }}
          pb={{ base: MOBILE_CONTENT_BOTTOM_PADDING, md: 10 }}
          maxW="8xl"
          mx="auto"
          h={{ base: "calc(100dvh - 72px)", md: "calc(100dvh - 80px)" }}
          overflow="hidden"
        >
          {children}
        </Box>
      </Box>

      <MobileBottomNav
        role={normalizedRole}
        displayName={displayName}
        companyName={companyName}
        pathname={pathname}
        onLogout={handleLogout}
      />
    </Box>
  );
}
