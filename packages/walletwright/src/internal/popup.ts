import type { BrowserContext, Locator, Page } from "@playwright/test";

import { waitUntil } from "./wait";

/** MetaMask/Phantom approval-popup URL token; Slush overrides it with `notificationMatch: "isPopup=1"`. */
export const DEFAULT_NOTIFICATION_MATCH = "notification.html";

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
  match,
  timeoutMs,
}: {
  /** From `WalletDefinition.approvalControls`, for a wallet that can render its popup requestless. */
  approvalControls: ((page: Page) => Locator) | undefined;
  context: BrowserContext;
  extensionId: string;
  match: string;
  timeoutMs: number;
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
