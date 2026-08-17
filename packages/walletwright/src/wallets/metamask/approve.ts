import type { Locator, Page } from "@playwright/test";

/**
 * How long a confirm or cancel button gets to become clickable, once the page is already showing
 * one. Generous because a loaded CI runner renders MetaMask's footer slowly.
 */
const BUTTON_TIMEOUT_MS = 45_000;
/** The retry only covers a notice that rendered late, so it does not need the full budget again. */
const RETRY_TIMEOUT_MS = 10_000;

/** Snap notices intercept footer clicks and disable Accept until their content is scrolled. */
const acceptThirdPartyNotice = async (popup: Page): Promise<void> => {
  const modal = popup.locator(".snap-install-warning");
  if ((await modal.count().catch(() => 0)) === 0) {
    return;
  }
  await modal
    .locator("p")
    .last()
    .scrollIntoViewIfNeeded()
    .catch(() => {});
  await modal
    .getByRole("button", { name: "Accept" })
    .click({ timeout: 3000 })
    .catch(() => {});
};

/** Resolve the confirm test id used by standard, legacy, and Snap request footers. */
const confirmButton = (popup: Page): Locator =>
  popup
    .getByTestId("confirm-btn")
    .or(popup.getByTestId("confirm-footer-button"))
    .or(popup.locator('[data-testid="page-container-footer-next"]'))
    .or(popup.locator('[data-testid$="-confirm-snap-footer-button"]'))
    .first();

const cancelButton = (popup: Page): Locator =>
  popup
    .getByTestId("cancel-btn")
    .or(popup.getByTestId("confirm-footer-cancel-button"))
    .or(popup.locator('[data-testid="page-container-footer-cancel"]'))
    .or(popup.locator('[data-testid$="-cancel-snap-footer-button"]'))
    .first();

/** Distinguishes a pending request from MetaMask's requestless notification home screen. */
export const approvalControls = (popup: Page): Locator =>
  confirmButton(popup).or(cancelButton(popup));

/**
 * Click one of the popup's footer buttons. The third-party notice covers that whole footer, so both
 * confirm and cancel are intercepted while it is up, and both need the dismiss-then-retry: without it
 * a click times out against a button that is rendered and enabled, which reads as a stale selector.
 */
const clickFooterButton = async (popup: Page, button: Locator): Promise<void> => {
  await acceptThirdPartyNotice(popup);
  try {
    await button.click({ timeout: BUTTON_TIMEOUT_MS });
  } catch (error) {
    await acceptThirdPartyNotice(popup);
    await button.click({ timeout: RETRY_TIMEOUT_MS }).catch(() => {
      throw error;
    });
  }
};

export const approve = (popup: Page): Promise<void> =>
  clickFooterButton(popup, confirmButton(popup));

/** The cancel counterpart of `approve`; same union-by-DOM-order resolution, not written order. */
export const reject = (popup: Page): Promise<void> => clickFooterButton(popup, cancelButton(popup));
