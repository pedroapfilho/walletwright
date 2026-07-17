import { describe, expect, it } from "vitest";

import type { WalletSetup } from "../types.ts";

import { extensionIdFromPath, profileKey } from "./utils.ts";

const baseSetup: WalletSetup = {
  password: "correct-horse-battery-staple",
  seedPhrase: "test test test test test test test test test test test junk",
  wallet: "metamask",
};

describe("profileKey", () => {
  it("returns a 20-character lowercase hex string", () => {
    const key = profileKey(baseSetup);
    expect(key).toMatch(/^[0-9a-f]{20}$/v);
  });

  it("is deterministic for the same setup", () => {
    expect(profileKey(baseSetup)).toBe(profileKey({ ...baseSetup }));
  });

  it("changes when the wallet changes", () => {
    expect(profileKey({ ...baseSetup, wallet: "phantom" })).not.toBe(profileKey(baseSetup));
  });

  it("changes when the version changes", () => {
    expect(profileKey({ ...baseSetup, version: "1.2.3" })).not.toBe(profileKey(baseSetup));
  });

  it("changes when the seed phrase changes", () => {
    expect(profileKey({ ...baseSetup, seedPhrase: "different seed phrase entirely" })).not.toBe(
      profileKey(baseSetup),
    );
  });

  it("changes when the password changes", () => {
    expect(profileKey({ ...baseSetup, password: "different-password" })).not.toBe(
      profileKey(baseSetup),
    );
  });
});

describe("extensionIdFromPath", () => {
  const fakePath = "/tmp/walletwright-does-not-exist-xyz";

  // extensionIdFromPath slices 32 hex chars (16 bytes) off the sha256 digest and maps each
  // nibble to a..p, one char per nibble, so the real output is 32 characters, not the 16-char
  // extension-id-length shorthand used elsewhere.
  it("returns a 32-character string in a..p for a path with no manifest.json on disk", () => {
    expect(extensionIdFromPath(fakePath)).toMatch(/^[a-p]{32}$/v);
  });

  it("is deterministic for the same path", () => {
    expect(extensionIdFromPath(fakePath)).toBe(extensionIdFromPath(fakePath));
  });

  it("differs for a different path", () => {
    expect(extensionIdFromPath("/tmp/walletwright-does-not-exist-abc")).not.toBe(
      extensionIdFromPath(fakePath),
    );
  });
});
