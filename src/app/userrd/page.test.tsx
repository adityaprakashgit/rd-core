import { describe, expect, it, vi } from "vitest";

const redirectMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import LegacyUserRdPageRedirect from "./page";

describe("legacy /userrd redirect", () => {
  it("redirects to /rnd", () => {
    LegacyUserRdPageRedirect();
    expect(redirectMock).toHaveBeenCalledWith("/rnd");
  });
});
