"use client";

import { useLayoutEffect } from "react";
import { ChakraProvider } from "@chakra-ui/react";
import { RoleProvider } from "@/context/RoleContext";
import { WorkspaceViewProvider } from "@/context/WorkspaceViewContext";
import { appTheme } from "@/theme";
import { clearStoredAuth, getStoredAuth } from "@/lib/auth-client";
import { CLIENT_AUTH_BYPASS_ENABLED } from "@/lib/runtime-flags";

export function Providers({ children }: { children: React.ReactNode }) {
  useLayoutEffect(() => {
    const originalFetch = window.fetch.bind(window);
    let redirectingToLogin = false;

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

      const response = await originalFetch(input, {
        ...init,
        headers,
      });

      if (
        !CLIENT_AUTH_BYPASS_ENABLED &&
        response.status === 401 &&
        !requestUrl.includes("/api/auth/login") &&
        !requestUrl.includes("/api/auth/signup")
      ) {
        clearStoredAuth();
        if (!redirectingToLogin) {
          redirectingToLogin = true;
          window.location.assign("/login");
        }
      }

      return response;
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
