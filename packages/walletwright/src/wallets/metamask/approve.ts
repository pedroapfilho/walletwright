import type { Locator, Page } from "@playwright/test";

/**
 * How long a confirm or cancel button gets to become clickable, once the page is already showing
 * one. Generous because a loaded CI runner renders MetaMask's footer slowly.
 */
const BUTTON_TIMEOUT_MS = 45_000;
/** The retry only covers a notice that rendered late, so it does not need the full budget again. */
const RETRY_TIMEOUT_MS = 10_000;

/**
 * First-time requests that MetaMask routes through a protocol Snap (e.g. adding a custom chain)
 * open a "Third-party software notice" modal over the confirm footer, and every click is
 * intercepted until it is accepted. Its buttons carry no testids, only text, and Accept stays
 * disabled until the notice is scrolled to the bottom.
 */
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

/**
 * Confirm buttons differ by request type: connect popups use `confirm-btn`, signature and
 * transaction popups use `confirm-footer-button`, older builds used `page-container-footer-next`,
 * and requests routed through a protocol Snap (e.g. Solana) use
 * `confirm-<type>-confirm-snap-footer-button`, matched by suffix so every snap confirmation type is
 * covered. A popup renders exactly one of these buttons; the `.or()` union resolves whichever one
 * is present by DOM order, not by the order it's written in below, so one locator covers every
 * popup.
 */
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

/**
 * What "this page is showing a request" means for MetaMask, as opposed to its wallet home. The
 * distinction matters for the page walletwright opens itself: `notification.html` renders the home
 * screen (account header, Buy/Swap/Send, a news carousel) when nothing is pending, so buttons on
 * screen prove nothing. A CI run handed that home screen to `approve` and waited out the full click
 * budget against a confirm button that was never going to exist.
 */
export const approvalControls = (popup: Page): Locator =>
  confirmButton(popup).or(cancelButton(popup));

export const approve = async (popup: Page): Promise<void> => {
  const button = confirmButton(popup);
  await acceptThirdPartyNotice(popup);
  try {
    await button.click({ timeout: BUTTON_TIMEOUT_MS });
  } catch (error) {
    // The notice can render after the first accept attempt; clear it once and retry.
    await acceptThirdPartyNotice(popup);
    await button.click({ timeout: RETRY_TIMEOUT_MS }).catch(() => {
      throw error;
    });
  }
};

/** The cancel counterparts of `approve`; same union-by-DOM-order resolution, not written order. */
export const reject = async (popup: Page): Promise<void> => {
  await cancelButton(popup).click({ timeout: BUTTON_TIMEOUT_MS });
};
