import { describe, expect, it } from "vitest";

import { isLotVersionConflict, parseExpectedUpdatedAt } from "./lot-concurrency";

describe("lot concurrency helpers", () => {
  it("accepts valid expectedUpdatedAt values", () => {
    const result = parseExpectedUpdatedAt("2026-04-08T12:30:00.000Z");
    expect(result.ok).toBe(true);
  });

  it("rejects invalid expectedUpdatedAt values", () => {
    const result = parseExpectedUpdatedAt("not-a-date");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("valid ISO date");
    }
  });

  it("detects stale lot versions", () => {
    const expected = new Date("2026-04-08T12:00:00.000Z");
    const stale = "2026-04-08T12:00:01.000Z";
    expect(isLotVersionConflict(stale, expected)).toBe(true);
    expect(isLotVersionConflict("2026-04-08T12:00:00.000Z", expected)).toBe(false);
  });
});
