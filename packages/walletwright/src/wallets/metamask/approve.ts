import type { Locator, Page } from "@playwright/test";

import { clicksFor } from "../../internal/click";
import { waitUntil } from "../../internal/wait";
import type { ApprovalScreen, ApprovalWindow } from "../../types";

const { click } = clicksFor("MetaMask");

const NOTICE = ".snap-install-warning";

/**
 * A Snap's third-party notice covers the whole footer, so it intercepts confirm and cancel alike,
 * and its Accept stays disabled until the notice is scrolled to the bottom.
 */
const thirdPartyNotice: ApprovalScreen = {
  pass: async (popup) => {
    const notice = popup.locator(NOTICE);
    await notice
      .locator("p")
      .last()
      .scrollIntoViewIfNeeded()
      .catch(() => {});
    await click(notice.getByRole("button", { name: "Accept" }));
  },
  shows: async (popup) => {
    try {
      return await popup.locator(NOTICE).first().isVisible();
    } catch {
      return false;
    }
  },
};

/** How long a connect page may keep Connect disabled before it counts as rendered too early. */
const STALE_CONNECT_MS = 3000;
const READ_TIMEOUT_MS = 500;

const connectButton = (popup: Page): Locator => popup.getByTestId("confirm-btn");

const connectEnabled = async (popup: Page): Promise<boolean> => {
  try {
    return await connectButton(popup).isEnabled({ timeout: READ_TIMEOUT_MS });
  } catch {
    return false;
  }
};

/**
 * MetaMask can render a connect page before enabling the requested network (seen with Solana): no
 * networks under Permissions, Connect disabled, never recomputed. The request is still pending, so
 * a reload renders it from current state. Connect route only: elsewhere a disabled confirm is busy.
 */
export const staleConnectPage: ApprovalScreen = {
  pass: async (popup) => {
    const enabled = await waitUntil(() => connectEnabled(popup), { timeoutMs: STALE_CONNECT_MS });

    if (enabled === undefined) {
      await popup.reload();
    }
  },
  shows: async (popup) =>
    popup.url().includes("#/connect/") &&
    (await connectButton(popup)
      .isVisible()
      .catch(() => false)) &&
    !(await connectEnabled(popup)),
};

/**
 * MetaMask's approval window. Its popup can render the requestless home screen, which the confirm
 * and cancel test ids tell apart from a request. Locators only: LavaMoat scuttles `page.evaluate`.
 */
export const approval: ApprovalWindow = {
  cancel: (popup) =>
    popup
      .getByTestId("cancel-btn")
      .or(popup.getByTestId("confirm-footer-cancel-button"))
      .or(popup.locator('[data-testid="page-container-footer-cancel"]'))
      .or(popup.locator('[data-testid$="-cancel-snap-footer-button"]')),
  confirm: (popup) =>
    popup
      .getByTestId("confirm-btn")
      .or(popup.getByTestId("confirm-footer-button"))
      .or(popup.locator('[data-testid="page-container-footer-next"]'))
      .or(popup.locator('[data-testid$="-confirm-snap-footer-button"]')),
  screens: [thirdPartyNotice, staleConnectPage],
};
