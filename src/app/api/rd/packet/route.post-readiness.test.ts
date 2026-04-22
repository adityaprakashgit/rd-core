import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeMock: vi.fn(),
  getCurrentUserFromRequestMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock("@/lib/rbac", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rbac")>("@/lib/rbac");
  return {
    ...actual,
    authorize: mocks.authorizeMock,
  };
});

vi.mock("@/lib/session", () => ({
  getCurrentUserFromRequest: mocks.getCurrentUserFromRequestMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transactionMock,
  },
}));

import { POST } from "./route";

describe("/api/rd/packet POST readiness errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUserFromRequestMock.mockResolvedValue({
      id: "ops-1",
      companyId: "company-1",
      role: "OPERATIONS",
    });
    mocks.authorizeMock.mockReturnValue(undefined);
  });

  it("returns actionable readiness blockers when sample is not ready", async () => {
    mocks.transactionMock.mockRejectedValue(
      new Error(
        "SAMPLE_NOT_READY:Bag evidence: Sealed sample photo is missing. Upload it in Homogeneous Sampling > Step 3 Capture proof with the seal number visible. | Sample packet evidence: Homogeneous confirmation is missing. Mark the sample homogenized in Homogeneous Sampling > Step 4 Homogenize.",
      ),
    );

    const response = await POST(
      {
        json: async () => ({
          sampleId: "sample-1",
          count: 1,
          packets: [{ packetWeight: 1, packetUnit: "KG", packetUse: "TESTING" }],
        }),
      } as NextRequest,
    );

    expect(response.status).toBe(422);
    const payload = (await response.json()) as { details?: string };
    expect(payload.details).toContain("Sample is not ready for packeting yet.");
    expect(payload.details).toContain("Sealed sample photo is missing");
  });
});
