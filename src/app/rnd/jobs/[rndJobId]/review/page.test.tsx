import { describe, expect, it, vi } from "vitest";

const redirectMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import RndJobReviewRedirect from "./page";

describe("/rnd/jobs/[rndJobId]/review", () => {
  it("deep-links to detail review tab", async () => {
    await RndJobReviewRedirect({ params: Promise.resolve({ rndJobId: "rnd-1" }) });
    expect(redirectMock).toHaveBeenCalledWith("/rnd/jobs/rnd-1?tab=review");
  });
});
