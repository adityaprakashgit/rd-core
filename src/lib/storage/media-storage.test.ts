import { describe, expect, it } from "vitest";

import { getMediaStorageProviderType } from "./media-storage";

describe("media storage provider", () => {
  it("defaults to LOCAL for unset or invalid provider", () => {
    expect(getMediaStorageProviderType(undefined)).toBe("LOCAL");
    expect(getMediaStorageProviderType("invalid-provider")).toBe("LOCAL");
  });

  it("accepts LOCAL provider explicitly", () => {
    expect(getMediaStorageProviderType("LOCAL")).toBe("LOCAL");
    expect(getMediaStorageProviderType("local")).toBe("LOCAL");
  });
});
