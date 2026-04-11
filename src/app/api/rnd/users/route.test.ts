import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeMock: vi.fn(),
  getCurrentUserFromRequestMock: vi.fn(),
  searchRndUsersMock: vi.fn(),
}));

vi.mock("@/lib/rbac", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rbac")>("@/lib/rbac");
  return { ...actual, authorize: mocks.authorizeMock };
});
vi.mock("@/lib/session", () => ({
  getCurrentUserFromRequest: mocks.getCurrentUserFromRequestMock,
}));
vi.mock("@/lib/rnd-user-picker", () => ({
  searchRndUsers: mocks.searchRndUsersMock,
}));

import { GET } from "./route";

describe("/api/rnd/users GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUserFromRequestMock.mockResolvedValue({ id: "u1", companyId: "c1", role: "RND" });
    mocks.authorizeMock.mockReturnValue(undefined);
    mocks.searchRndUsersMock.mockResolvedValue([]);
  });

  it("uses assignee scope as default", async () => {
    await GET({ nextUrl: { searchParams: new URLSearchParams("q=a") } } as unknown as NextRequest);
    expect(mocks.searchRndUsersMock).toHaveBeenCalledWith(
      expect.objectContaining({
        roles: ["RND"],
      }),
    );
  });

  it("uses approver scope with admin+rnd roles", async () => {
    await GET({ nextUrl: { searchParams: new URLSearchParams("roleScope=APPROVER") } } as unknown as NextRequest);
    expect(mocks.searchRndUsersMock).toHaveBeenCalledWith(
      expect.objectContaining({
        roles: ["ADMIN", "RND"],
      }),
    );
  });
});
