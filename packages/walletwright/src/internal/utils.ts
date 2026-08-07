import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";

import type { BrowserContext, Locator, Page } from "@playwright/test";

import type { WalletSetup } from "../types";

import { gotoWithRetry, waitUntil } from "./wait";

export const DEFAULT_CACHE_DIR = ".walletwright";

/** MetaMask/Phantom approval-popup URL token; Slush overrides it with `notificationMatch: "isPopup=1"`. */
export const DEFAULT_NOTIFICATION_MATCH = "notification.html";

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
    const manifest: unknown = JSON.parse(readFileSync(path.join(abs, "manifest.json"), "utf8"));
    if (typeof manifest === "object" && manifest !== null && "key" in manifest) {
      key = typeof manifest.key === "string" ? manifest.key : undefined;
    }
  } catch {
    // manifest not present yet, fall back to the path
  }
  const source =
    key === undefined || key === "" ? Buffer.from(abs, "utf8") : Buffer.from(key, "base64");
  const hex = createHash("sha256").update(source).digest("hex").slice(0, 32);
  return Array.from(hex, (nibble) => String.fromCodePoint(97 + Number.parseInt(nibble, 16))).join(
    "",
  );
};

/**
 * Approval popups open as `about:blank` and then navigate, so `waitForEvent('page', { predicate })`
 * misses them, poll the open pages instead. `match` is the URL token identifying the popup
 * (`notification.html` for MetaMask/Phantom; `isPopup=1` for Slush's single-page `index.html`).
 */
export const isApprovalPopup = (page: Page, extensionId: string, match: string): boolean =>
  page.url().startsWith(`chrome-extension://${extensionId}`) &&
  page.url().includes(match) &&
  !page.isClosed();

const isVisible = async (locator: Locator): Promise<boolean> => {
  try {
    return await locator.isVisible();
  } catch {
    return false; // the page can go while we ask
  }
};

const hasVisibleButton = (page: Page): Promise<boolean> =>
  isVisible(page.locator("button").first());

export const findNotificationPopup = (
  context: BrowserContext,
  extensionId: string,
  match = DEFAULT_NOTIFICATION_MATCH,
  timeoutMs = 10_000,
): Promise<Page | undefined> =>
  waitUntil(
    async () => {
      const popup = context.pages().find((page) => isApprovalPopup(page, extensionId, match));
      if (!popup) {
        return undefined;
      }
      await popup.waitForLoadState("domcontentloaded").catch(() => {});
      // The window opens before the approval renders (bare URL, zero buttons) and routes later,
      // sometimes tens of seconds later under a busy MV3 worker. "Found" must mean "usable", so
      // keep polling the same shell until a button shows up rather than handing back a blank page.
      return (await hasVisibleButton(popup)) ? popup : undefined;
    },
    { timeoutMs },
  );

/** A pending approval, and whether the engine opened the page it is on (and so must close it). */
export type Approval = { owned: boolean; page: Page };

const APPROVAL_POLL_INTERVAL_MS = 250;
const APPROVAL_ENTRY_LOAD_TIMEOUT_MS = 10_000;

/**
 * Wait for whichever approval page the wallet routes first: the window it spawned, or the approval
 * entry opened here after `openAfterMs`.
 *
 * Both have to be watched throughout, because neither is guaranteed. Whether a headless approval
 * window surfaces as a page is per-wallet (Phantom's does, MetaMask's does not), and how long the
 * wallet takes to route either one varies by an order of magnitude with machine load, so a
 * one-then-the-other search misses whichever arrives outside its own slice of the budget.
 *
 * Returns `undefined`, leaving no page behind, when nothing is pending: a normal outcome for an
 * optional approval that the wallet auto-approved.
 */
export const awaitApproval = async ({
  approvalControls,
  context,
  extensionId,
  match = DEFAULT_NOTIFICATION_MATCH,
  notificationPage,
  openAfterMs,
  timeoutMs,
}: {
  /** From `WalletDefinition.approvalControls`; tells a request apart from the wallet's idle UI. */
  approvalControls?: (page: Page) => Locator;
  context: BrowserContext;
  extensionId: string;
  match?: string;
  /** Extension-relative approval entry, from `WalletDefinition.notificationPage`. */
  notificationPage: string;
  /** Grace given to the wallet's own window before the engine opens the entry itself. */
  openAfterMs: number;
  timeoutMs: number;
}): Promise<Approval | undefined> => {
  const entry = `chrome-extension://${extensionId}/${notificationPage}`;
  const startedAt = Date.now();
  let own: Page | undefined;

  /**
   * The page opened here exists whether or not anything is pending, and an idle one is not blank:
   * MetaMask's `notification.html` renders its whole home screen. So it counts only once the wallet
   * declares a request on it, and failing that, once it has at least left the entry URL.
   */
  const showsRequest = async (page: Page): Promise<boolean> => {
    if (approvalControls !== undefined) {
      return isVisible(approvalControls(page).first());
    }
    return page.url() !== entry && (await hasVisibleButton(page));
  };

  const found = await waitUntil(
    async () => {
      for (const page of context.pages()) {
        if (!isApprovalPopup(page, extensionId, match)) {
          continue;
        }
        // A window the wallet spawned exists *because* a request is pending, so a rendered button
        // is enough, and it has to be: Phantom's popup sits on the same URL as the entry and would
        // fail the stricter test below.
        const ready = page === own ? await showsRequest(page) : await hasVisibleButton(page);
        if (ready) {
          return page;
        }
      }
      if (own !== undefined || Date.now() - startedAt < openAfterMs) {
        return undefined;
      }
      const page = await context.newPage();
      try {
        await gotoWithRetry(page, entry, {
          label: "approval page",
          timeoutMs: APPROVAL_ENTRY_LOAD_TIMEOUT_MS,
        });
        own = page;
      } catch {
        await page.close().catch(() => {}); // try again on the next tick rather than give up
      }
      return undefined;
    },
    { intervalMs: APPROVAL_POLL_INTERVAL_MS, timeoutMs },
  );

  if (own !== undefined && found !== own) {
    await own.close().catch(() => {}); // the wallet's own window won the race, or nothing did
  }
  return found ? { owned: found === own, page: found } : undefined;
};

/** Where Chrome persists an extension's `chrome.storage.local` inside a browser profile. */
export const extensionStateDir = (profileDir: string, extensionId: string): string =>
  path.join(profileDir, "Default", "Local Extension Settings", extensionId);

export const hasNotificationPopup = (
  context: BrowserContext,
  extensionId: string,
  match = DEFAULT_NOTIFICATION_MATCH,
): boolean => context.pages().some((page) => isApprovalPopup(page, extensionId, match));
