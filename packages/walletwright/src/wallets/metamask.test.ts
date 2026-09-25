import { describe, expect, it } from "vitest";

import { DEFAULT_VERSION, metamaskRelease } from "./metamask";

describe("metamaskRelease", () => {
  it("pins an integrity hash for the version the wallet defaults to", () => {
    const { sha256, url } = metamaskRelease(DEFAULT_VERSION);

    expect(sha256).toMatch(/^[0-9a-f]{64}$/v);
    expect(url).toContain(`v${DEFAULT_VERSION}/metamask-chrome-${DEFAULT_VERSION}.zip`);
  });

  it("leaves sha256 undefined for a caller-pinned version with no recorded hash", () => {
    expect(metamaskRelease("0.0.0").sha256).toBeUndefined();
  });

  it("names the extraction directory after the version", () => {
    expect(metamaskRelease("13.35.1")).toMatchObject({
      format: "zip",
      name: "metamask-chrome-13.35.1",
    });
  });
});
