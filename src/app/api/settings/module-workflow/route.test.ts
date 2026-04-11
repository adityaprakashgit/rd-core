import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { defaultModuleWorkflowSettings } from "@/lib/module-workflow-policy";

const mocks = vi.hoisted(() => ({
  upsertMock: vi.fn(),
  authorizeMock: vi.fn(),
  getCurrentUserFromRequestMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    moduleWorkflowSettings: {
      upsert: mocks.upsertMock,
    },
  },
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

import { GET, PATCH } from "./route";

function buildSettingsRow(overrides?: Partial<{
  requiredImageCategories: string[];
  optionalImageCategories: string[];
  hiddenImageCategories: string[];
}>) {
  return {
    id: "settings-1",
    companyId: "company-1",
    ...defaultModuleWorkflowSettings,
    requiredImageCategories: overrides?.requiredImageCategories ?? defaultModuleWorkflowSettings.requiredImageCategories,
    optionalImageCategories: overrides?.optionalImageCategories ?? defaultModuleWorkflowSettings.optionalImageCategories,
    hiddenImageCategories: overrides?.hiddenImageCategories ?? defaultModuleWorkflowSettings.hiddenImageCategories,
    createdAt: new Date("2026-04-10T00:00:00.000Z"),
    updatedAt: new Date("2026-04-10T00:00:00.000Z"),
  };
}

describe("/api/settings/module-workflow route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUserFromRequestMock.mockResolvedValue({
      id: "user-1",
      companyId: "company-1",
      role: "ADMIN",
    });
    mocks.authorizeMock.mockReturnValue(undefined);
  });

  it("GET returns healed image buckets when persisted row is all-empty", async () => {
    mocks.upsertMock.mockResolvedValueOnce(
      buildSettingsRow({
        requiredImageCategories: [],
        optionalImageCategories: [],
        hiddenImageCategories: [],
      }),
    );

    const response = await GET({} as NextRequest);
    const payload = (await response.json()) as {
      images: {
        requiredImageCategories: string[];
        optionalImageCategories: string[];
        hiddenImageCategories: string[];
      };
    };

    expect(response.status).toBe(200);
    expect(payload.images.requiredImageCategories).toEqual(defaultModuleWorkflowSettings.requiredImageCategories);
    expect(payload.images.optionalImageCategories).toEqual(defaultModuleWorkflowSettings.optionalImageCategories);
    expect(payload.images.hiddenImageCategories).toEqual(defaultModuleWorkflowSettings.hiddenImageCategories);
  });

  it("PATCH preserves intentional custom image buckets", async () => {
    mocks.upsertMock.mockResolvedValueOnce(
      buildSettingsRow({
        requiredImageCategories: ["BAG_CONDITION"],
        optionalImageCategories: ["LOT_OVERVIEW"],
        hiddenImageCategories: ["DAMAGE_PHOTO"],
      }),
    );

    const response = await PATCH({
      json: async () => ({
        images: {
          requiredImageCategories: ["BAG_CONDITION"],
          optionalImageCategories: ["LOT_OVERVIEW"],
          hiddenImageCategories: ["DAMAGE_PHOTO"],
          imageTimestampRequired: true,
        },
      }),
    } as NextRequest);

    const payload = (await response.json()) as {
      images: {
        requiredImageCategories: string[];
        optionalImageCategories: string[];
        hiddenImageCategories: string[];
      };
    };

    expect(response.status).toBe(200);
    expect(payload.images.requiredImageCategories).toEqual(["BAG_CONDITION"]);
    expect(payload.images.optionalImageCategories).toEqual(["LOT_OVERVIEW"]);
    expect(payload.images.hiddenImageCategories).toEqual(["DAMAGE_PHOTO"]);

    const upsertArgs = mocks.upsertMock.mock.calls[0]?.[0] as {
      update: {
        requiredImageCategories: string[];
        optionalImageCategories: string[];
        hiddenImageCategories: string[];
      };
    };
    expect(upsertArgs.update.requiredImageCategories).toEqual(["BAG_CONDITION"]);
    expect(upsertArgs.update.optionalImageCategories).toEqual(["LOT_OVERVIEW"]);
    expect(upsertArgs.update.hiddenImageCategories).toEqual(["DAMAGE_PHOTO"]);
  });

  it("PATCH with all-empty buckets is auto-healed by design", async () => {
    mocks.upsertMock.mockResolvedValueOnce(
      buildSettingsRow({
        requiredImageCategories: [],
        optionalImageCategories: [],
        hiddenImageCategories: [],
      }),
    );

    const response = await PATCH({
      json: async () => ({
        images: {
          requiredImageCategories: [],
          optionalImageCategories: [],
          hiddenImageCategories: [],
          imageTimestampRequired: false,
        },
      }),
    } as NextRequest);

    const payload = (await response.json()) as {
      images: {
        requiredImageCategories: string[];
        optionalImageCategories: string[];
        hiddenImageCategories: string[];
      };
    };

    expect(response.status).toBe(200);
    expect(payload.images.requiredImageCategories).toEqual(defaultModuleWorkflowSettings.requiredImageCategories);
    expect(payload.images.optionalImageCategories).toEqual(defaultModuleWorkflowSettings.optionalImageCategories);
    expect(payload.images.hiddenImageCategories).toEqual(defaultModuleWorkflowSettings.hiddenImageCategories);

    const upsertArgs = mocks.upsertMock.mock.calls[0]?.[0] as {
      update: {
        requiredImageCategories: string[];
        optionalImageCategories: string[];
        hiddenImageCategories: string[];
      };
    };
    expect(upsertArgs.update.requiredImageCategories).toEqual(defaultModuleWorkflowSettings.requiredImageCategories);
    expect(upsertArgs.update.optionalImageCategories).toEqual(defaultModuleWorkflowSettings.optionalImageCategories);
    expect(upsertArgs.update.hiddenImageCategories).toEqual(defaultModuleWorkflowSettings.hiddenImageCategories);
  });

  it("PATCH rejects non-canonical image category values", async () => {
    const response = await PATCH({
      json: async () => ({
        images: {
          requiredImageCategories: ["Bag photo with visible LOT no"],
          optionalImageCategories: [],
          hiddenImageCategories: [],
          imageTimestampRequired: false,
        },
      }),
    } as NextRequest);

    const payload = (await response.json()) as {
      code: string;
      details: string;
    };

    expect(response.status).toBe(422);
    expect(payload.code).toBe("POLICY_CATEGORY_INVALID");
    expect(payload.details).toContain("requiredImageCategories=Bag photo with visible LOT no");
    expect(mocks.upsertMock).not.toHaveBeenCalled();
  });
});
