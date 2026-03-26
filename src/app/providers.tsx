"use client";

import { ChakraProvider } from "@chakra-ui/react";
import { RoleProvider } from "@/context/RoleContext";
import { WorkspaceViewProvider } from "@/context/WorkspaceViewContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ChakraProvider>
      <RoleProvider>
        <WorkspaceViewProvider>{children}</WorkspaceViewProvider>
      </RoleProvider>
    </ChakraProvider>
  );
}
