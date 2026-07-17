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
 * covered. Try them together so one call covers every popup.
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

/** The cancel counterparts of `approve`, in the same order: connect, sign/tx, old build, snap. */
export const reject = async (popup: Page): Promise<void> => {
  const button = popup
    .getByTestId("cancel-btn")
    .or(popup.getByTestId("confirm-footer-cancel-button"))
    .or(popup.locator('[data-testid="page-container-footer-cancel"]'))
    .or(popup.locator('[data-testid$="-cancel-snap-footer-button"]'))
    .first();
  await button.click({ timeout: 15_000 });
};
