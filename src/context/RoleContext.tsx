"use client";

import { createContext, useContext, useState } from "react";
import { Role } from "@/lib/role";

const RoleContext = createContext<{
  role: Role;
  setRole: (r: Role) => void;
}>({
  role: null,
  setRole: () => {},
});

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>(null);

  return (
    <RoleContext.Provider value={{ role, setRole }}>{children}</RoleContext.Provider>
  );
}

export const useRole = () => useContext(RoleContext);
