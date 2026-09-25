import { describe, expect, it } from "vitest";

import type { WalletSetup } from "../types";

import { extensionArchive, extensionIdFromPath } from "./extension";

const setup = (wallet: WalletSetup["wallet"]): WalletSetup => ({
  password: "pw",
  seedPhrase: "a b c",
  wallet,
});

describe("extensionArchive", () => {
  it("resolves the default release when the setup pins no version", () => {
    expect(extensionArchive(setup("metamask"))).toMatchObject({
      format: "zip",
      sha256: expect.stringMatching(/^[0-9a-f]{64}$/v),
    });
  });

  it("resolves the release the setup pins", () => {
    expect(extensionArchive({ ...setup("metamask"), version: "13.0.0" })).toMatchObject({
      name: "metamask-chrome-13.0.0",
      sha256: undefined,
    });
  });

  it("keeps each Web Store wallet in its own latest-build directory", () => {
    expect(extensionArchive(setup("phantom"))).toEqual({
      format: "crx",
      name: "phantom-chrome-latest",
      sha256: undefined,
      url: expect.stringContaining("bfnaelmomeimhlpmgjnjophhpkkoljpa"),
    });
  });

  it("refuses a version for a Web Store wallet instead of ignoring it", () => {
    expect(() => extensionArchive({ ...setup("phantom"), version: "1.0.0" })).toThrow(
      /Phantom runs its Chrome Web Store build, which cannot be pinned/v,
    );
  });
});

describe("extensionIdFromPath", () => {
  const fakePath = "/tmp/walletwright-does-not-exist-xyz";

  it("returns a 32-character string in a..p for a path with no manifest.json on disk", async () => {
    await expect(extensionIdFromPath(fakePath)).resolves.toMatch(/^[a-p]{32}$/v);
  });

  it("is deterministic for the same path", async () => {
    const ids = await Promise.allSettled([
      extensionIdFromPath(fakePath),
      extensionIdFromPath(fakePath),
    ]);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toEqual(ids[1]);
  });

  it("differs for a different path", async () => {
    const ids = await Promise.allSettled([
      extensionIdFromPath("/tmp/walletwright-does-not-exist-abc"),
      extensionIdFromPath(fakePath),
    ]);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toEqual(ids[1]);
  });
});
