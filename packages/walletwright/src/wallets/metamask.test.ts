import { describe, expect, it } from "vitest";

import { DEFAULT_VERSION, metamaskRelease } from "./metamask";

describe("metamaskRelease", () => {
  it("pins an integrity hash for the version the wallet defaults to", () => {
    expect(metamaskRelease(DEFAULT_VERSION).sha256).toMatch(/^[0-9a-f]{64}$/v);
  });

  it("leaves sha256 undefined for a caller-pinned version with no recorded hash", () => {
    expect(metamaskRelease("0.0.0").sha256).toBeUndefined();
  });
});
