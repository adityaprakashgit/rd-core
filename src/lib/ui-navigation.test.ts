import { describe, expect, it } from "vitest";

import { getMobileMoreModules, getVisibleModules, resolvePageDefinition } from "@/lib/ui-navigation";

describe("ui navigation", () => {
  it("exposes playground in the approved workspace roles", () => {
    const adminModules = getVisibleModules("ADMIN");
    const rndModules = getVisibleModules("RND");

    expect(adminModules.some((module) => module.id === "playground")).toBe(true);
    expect(rndModules.some((module) => module.id === "playground")).toBe(true);
  });

  it("keeps playground in the mobile more menu for supported roles", () => {
    expect(getMobileMoreModules("ADMIN").some((module) => module.id === "playground")).toBe(true);
    expect(getMobileMoreModules("RND").some((module) => module.id === "playground")).toBe(true);
  });

  it("resolves the playground page definition", () => {
    expect(resolvePageDefinition("/playground")).toMatchObject({
      id: "playground-home",
      title: "Playground",
      moduleId: "playground",
    });
  });
});
