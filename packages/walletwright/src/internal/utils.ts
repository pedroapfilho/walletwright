import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";

import type { BrowserContext, Page } from "@playwright/test";

import type { WalletSetup } from "../types.ts";

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const DEFAULT_CACHE_DIR = ".walletwright";

/** Stable per-setup profile directory name, so the same wallet+seed+password reuses one cache. */
export const profileKey = (setup: WalletSetup): string =>
  createHash("sha256")
    .update(`${setup.wallet}:${setup.version ?? "default"}:${setup.seedPhrase}:${setup.password}`)
    .digest("hex")
    .slice(0, 20);

/**
 * Compute an extension's id without querying the browser (`chrome://extensions` is blocked headless,
 * and the service worker starts lazily). Chrome derives the id from the sha256 of either the
 * manifest's public `key` (if present, e.g. Phantom → its fixed Web Store id) or the absolute load
 * path (no key, e.g. MetaMask), taking the first 16 bytes and mapping each nibble 0-f → a-p.
 *
 * The path is resolved through symlinks (`realpathSync`) because Chrome hashes the *real* path, a
 * cache under a symlinked dir (e.g. macOS `/tmp` → `/private/tmp`) would otherwise yield a wrong id.
 */
export const extensionIdFromPath = (extensionPath: string): string => {
  const resolved = path.resolve(extensionPath);
  const abs = (() => {
    try {
      return realpathSync(resolved);
    } catch {
      return resolved; // path doesn't exist yet, fall back to the literal resolved path
    }
  })();
  let key: string | undefined;
  try {
    key = (JSON.parse(readFileSync(path.join(abs, "manifest.json"), "utf8")) as { key?: string })
      .key;
  } catch {
    // manifest not present yet, fall back to the path
  }
  const source = key ? Buffer.from(key, "base64") : Buffer.from(abs, "utf8");
  const hex = createHash("sha256").update(source).digest("hex").slice(0, 32);
  return [...hex].map((nibble) => String.fromCodePoint(97 + Number.parseInt(nibble, 16))).join("");
};

/**
 * Approval popups open as `about:blank` and then navigate, so `waitForEvent('page', { predicate })`
 * misses them, poll the open pages instead. `match` is the URL token identifying the popup
 * (`notification.html` for MetaMask/Phantom; `isPopup=1` for Slush's single-page `index.html`).
 */
const isApprovalPopup = (page: Page, extensionId: string, match: string): boolean =>
  page.url().startsWith(`chrome-extension://${extensionId}`) &&
  page.url().includes(match) &&
  !page.isClosed();

export const findNotificationPopup = async (
  context: BrowserContext,
  extensionId: string,
  match = "notification.html",
  timeoutMs = 10_000,
): Promise<Page | undefined> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const popup = context.pages().find((page) => isApprovalPopup(page, extensionId, match));
    if (popup) {
      await popup.waitForLoadState("domcontentloaded").catch(() => {});
      return popup;
    }
    await sleep(200);
  }
  return undefined;
};

export const hasNotificationPopup = (
  context: BrowserContext,
  extensionId: string,
  match = "notification.html",
): boolean => context.pages().some((page) => isApprovalPopup(page, extensionId, match));
