"use client";

import { useEffect } from "react";
import { ChakraProvider } from "@chakra-ui/react";
import { RoleProvider } from "@/context/RoleContext";
import { WorkspaceViewProvider } from "@/context/WorkspaceViewContext";
import { appTheme } from "@/theme";
import { getStoredAuth } from "@/lib/auth-client";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const auth = getStoredAuth();
      if (!auth) {
        return originalFetch(input, init);
      }

      const requestUrl =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const isApiCall = requestUrl.startsWith("/api/") || requestUrl.includes(`${window.location.origin}/api/`);

      if (!isApiCall) {
        return originalFetch(input, init);
      }

      const headers = new Headers(init?.headers);
      headers.set("x-user-id", auth.userId);
      headers.set("x-company-id", auth.companyId);
      headers.set("x-user-role", auth.role);

      return originalFetch(input, {
        ...init,
        headers,
      });
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return (
    <ChakraProvider theme={appTheme}>
      <RoleProvider>
        <WorkspaceViewProvider>{children}</WorkspaceViewProvider>
      </RoleProvider>
    </ChakraProvider>
  );
}
