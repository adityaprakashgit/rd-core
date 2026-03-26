"use client";

import { ChakraProvider } from "@chakra-ui/react";
import { RoleProvider } from "@/context/RoleContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ChakraProvider>
      <RoleProvider>{children}</RoleProvider>
    </ChakraProvider>
  );
}
