"use client";

import { Box, Center, Drawer, DrawerContent, DrawerOverlay, Spinner, useDisclosure } from "@chakra-ui/react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Header } from "@/layout/Header";
import { Sidebar } from "@/layout/Sidebar";
import { useWorkspaceView } from "@/context/WorkspaceViewContext";
import { clearStoredAuth, getStoredAuth } from "@/lib/auth-client";

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
  const { isOpen, onOpen, onClose } = useDisclosure();
  const router = useRouter();
  const pathname = usePathname();
  const { viewMode, setViewMode } = useWorkspaceView();

  const [session, setSession] = useState<SessionPayload | null>(null);
  const [loading, setLoading] = useState(true);

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

  const onViewModeChange = useMemo(
    () => (nextView: "my" | "all") => {
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

  return (
    <Box minH="100vh" bg="bg.app">
      <Box display={{ base: "none", md: "block" }} position="fixed" insetY={0} left={0} zIndex={20}>
        <Sidebar role={session.role} companyName={companyName} displayName={displayName} onLogout={handleLogout} />
      </Box>

      <Drawer isOpen={isOpen} placement="left" onClose={onClose} size="xs">
        <DrawerOverlay />
        <DrawerContent>
          <Sidebar role={session.role} companyName={companyName} displayName={displayName} onLogout={handleLogout} />
        </DrawerContent>
      </Drawer>

      <Box ml={{ base: 0, md: 72 }} minH="100vh">
        <Header
          role={session.role}
          displayName={displayName}
          companyName={companyName}
          onOpenNav={onOpen}
          onLogout={handleLogout}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
        />

        <Box px={{ base: 4, md: 6 }} py={{ base: 4, md: 6 }} maxW="7xl" mx="auto">
          {children}
        </Box>
      </Box>
    </Box>
  );
}
