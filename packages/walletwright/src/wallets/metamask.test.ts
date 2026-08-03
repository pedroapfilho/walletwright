import { describe, expect, it } from "vitest";

import { metamaskDownload } from "./metamask";

describe("metamaskDownload", () => {
  it("pins an integrity hash for the version the wallet defaults to", () => {
    const { sha256, url } = metamaskDownload("/tmp/cache", "13.35.1");

    expect(sha256).toMatch(/^[0-9a-f]{64}$/v);
    expect(url).toContain("v13.35.1/metamask-chrome-13.35.1.zip");
  });

  it("leaves sha256 undefined for a caller-pinned version with no recorded hash", () => {
    expect(metamaskDownload("/tmp/cache", "0.0.0").sha256).toBeUndefined();
  });

  it("names the extraction directory after the version", () => {
    expect(metamaskDownload("/tmp/cache", "13.35.1")).toMatchObject({
      cacheDir: "/tmp/cache",
      kind: "zip",
      name: "metamask-chrome-13.35.1",
    });
  });
});
