import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirectMock: vi.fn(),
  findFirstMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirectMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    rndJob: {
      findFirst: mocks.findFirstMock,
    },
  },
}));

import LegacyUserRdJobRedirect from "./page";

describe("legacy /userrd/job/[jobId] redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to active rnd job when found", async () => {
    mocks.findFirstMock.mockResolvedValueOnce({ id: "rnd-active" });
    await LegacyUserRdJobRedirect({ params: Promise.resolve({ jobId: "job-1" }) });
    expect(mocks.redirectMock).toHaveBeenCalledWith("/rnd/jobs/rnd-active");
  });

  it("falls back to /rnd when no related rnd job exists", async () => {
    mocks.findFirstMock.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    await LegacyUserRdJobRedirect({ params: Promise.resolve({ jobId: "job-1" }) });
    expect(mocks.redirectMock).toHaveBeenCalledWith("/rnd");
  });
});
