"use client";

import { createContext, useContext, useState } from "react";

export type WorkspaceViewMode = "my" | "all";

const WorkspaceViewContext = createContext<{
  viewMode: WorkspaceViewMode;
  setViewMode: (mode: WorkspaceViewMode) => void;
}>({
  viewMode: "my",
  setViewMode: () => {},
});

export function WorkspaceViewProvider({ children }: { children: React.ReactNode }) {
  const [viewMode, setViewMode] = useState<WorkspaceViewMode>("my");

  return (
    <WorkspaceViewContext.Provider value={{ viewMode, setViewMode }}>
      {children}
    </WorkspaceViewContext.Provider>
  );
}

export function useWorkspaceView() {
  return useContext(WorkspaceViewContext);
}
