import { describe, expect, it } from "vitest";

import { workspaceJobSelect, workspaceJobSummarySelect } from "./job-workspace";

describe("job workspace selector contracts", () => {
  it("includes sealNumber on full workspace lot select", () => {
    const lotSelect = (workspaceJobSelect.lots as { select?: Record<string, unknown> })?.select ?? {};
    expect(lotSelect.sealNumber).toBe(true);
  });

  it("includes sealNumber on summary workspace lot select", () => {
    const lotSelect = (workspaceJobSummarySelect.lots as { select?: Record<string, unknown> })?.select ?? {};
    expect(lotSelect.sealNumber).toBe(true);
  });
});

