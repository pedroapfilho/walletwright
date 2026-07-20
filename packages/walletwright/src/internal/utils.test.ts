import type { Page } from "@playwright/test";
import { describe, expect, it } from "vitest";

import type { WalletSetup } from "../types.ts";

import { extensionIdFromPath, isApprovalPopup, profileKey } from "./utils.ts";

const fakePage = (url: string, closed = false): Page =>
  ({ isClosed: () => closed, url: () => url }) as unknown as Page;

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

describe("isApprovalPopup", () => {
  const extensionId = "abc";

  it("is true for a matching extension id and token on an open page", () => {
    const page = fakePage("chrome-extension://abc/notification.html");
    expect(isApprovalPopup(page, extensionId, "notification.html")).toBe(true);
  });

  it("is false when the extension id does not match", () => {
    const page = fakePage("chrome-extension://xyz/notification.html");
    expect(isApprovalPopup(page, extensionId, "notification.html")).toBe(false);
  });

  it("is false when the match token is absent", () => {
    const page = fakePage("chrome-extension://abc/home.html");
    expect(isApprovalPopup(page, extensionId, "notification.html")).toBe(false);
  });

  it("is false when the page is closed", () => {
    const page = fakePage("chrome-extension://abc/notification.html", true);
    expect(isApprovalPopup(page, extensionId, "notification.html")).toBe(false);
  });

  it("matches Slush's isPopup=1 single-page token", () => {
    const page = fakePage("chrome-extension://abc/index.html#/dapp?isPopup=1");
    expect(isApprovalPopup(page, extensionId, "isPopup=1")).toBe(true);
  });
});
