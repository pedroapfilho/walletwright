import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";

import type { BrowserContext, Locator, Page } from "@playwright/test";

import type { WalletSetup } from "../types";

import { waitUntil } from "./wait";

export const DEFAULT_CACHE_DIR = ".walletwright";

/** MetaMask/Phantom approval-popup URL token; Slush overrides it with `notificationMatch: "isPopup=1"`. */
export const DEFAULT_NOTIFICATION_MATCH = "notification.html";

/** Stable per-setup profile directory name, so the same wallet+seed+password reuses one cache. */
export const profileKey = (setup: WalletSetup): string =>
  createHash("sha256")
    .update(`${setup.wallet}:${setup.version ?? "default"}:${setup.seedPhrase}:${setup.password}`)
    .digest("hex")
    .slice(0, 20);

/** Mirror Chrome's extension-id derivation; resolve symlinks because Chrome hashes the real path. */
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

export const findNotificationPopup = ({
  approvalControls,
  context,
  extensionId,
  match = DEFAULT_NOTIFICATION_MATCH,
  timeoutMs = 10_000,
}: {
  /** From `WalletDefinition.approvalControls`, for a wallet that can render its popup requestless. */
  approvalControls?: (page: Page) => Locator;
  context: BrowserContext;
  extensionId: string;
  match?: string;
  timeoutMs?: number;
}): Promise<Page | undefined> =>
  waitUntil(
    async () => {
      const popup = context.pages().find((page) => isApprovalPopup(page, extensionId, match));
      if (!popup) {
        return undefined;
      }
      await popup.waitForLoadState("domcontentloaded").catch(() => {});
      const ready =
        approvalControls === undefined
          ? await hasVisibleButton(popup)
          : await isVisible(approvalControls(popup).first());
      return ready ? popup : undefined;
    },
    { timeoutMs },
  );

/** MetaMask's own popup dimensions, which its layout is built for. */
const APPROVAL_WINDOW = { height: 592, width: 360 };
/** Far enough from the edge that a popup this size lands fully on any usable display. */
const APPROVAL_WINDOW_OFFSET = 50;

/** Move approval popups on-screen; headless and unsupported CDP targets are ignored. */
export const placeApprovalWindow = async (page: Page): Promise<void> => {
  await page.setViewportSize(APPROVAL_WINDOW).catch(() => {});
  try {
    const session = await page.context().newCDPSession(page);
    const { targetInfo } = await session.send("Target.getTargetInfo");
    const { windowId } = await session.send("Browser.getWindowForTarget", {
      targetId: targetInfo.targetId,
    });
    await session.send("Browser.setWindowBounds", {
      bounds: { left: APPROVAL_WINDOW_OFFSET, top: APPROVAL_WINDOW_OFFSET },
      windowId,
    });
    await session.detach();
  } catch {
    // no window to place (headless), or the page refused a CDP session
  }
};

/** Where Chrome persists an extension's `chrome.storage.local` inside a browser profile. */
export const extensionStateDir = (profileDir: string, extensionId: string): string =>
  path.join(profileDir, "Default", "Local Extension Settings", extensionId);
