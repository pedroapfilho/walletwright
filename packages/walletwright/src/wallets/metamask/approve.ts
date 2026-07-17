import type { Page } from "@playwright/test";

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
export const approve = async (popup: Page): Promise<void> => {
  const button = popup
    .getByTestId("confirm-btn")
    .or(popup.getByTestId("confirm-footer-button"))
    .or(popup.locator('[data-testid="page-container-footer-next"]'))
    .or(popup.locator('[data-testid$="-confirm-snap-footer-button"]'))
    .first();
  await acceptThirdPartyNotice(popup);
  try {
    await button.click({ timeout: 15_000 });
  } catch (error) {
    // The notice can render after the first accept attempt; clear it once and retry.
    await acceptThirdPartyNotice(popup);
    await button.click({ timeout: 5000 }).catch(() => {
      throw error;
    });
  }
};

/** The cancel counterparts of `approve`; same union-by-DOM-order resolution, not written order. */
export const reject = async (popup: Page): Promise<void> => {
  const button = popup
    .getByTestId("cancel-btn")
    .or(popup.getByTestId("confirm-footer-cancel-button"))
    .or(popup.locator('[data-testid="page-container-footer-cancel"]'))
    .or(popup.locator('[data-testid$="-cancel-snap-footer-button"]'))
    .first();
  await button.click({ timeout: 15_000 });
};
