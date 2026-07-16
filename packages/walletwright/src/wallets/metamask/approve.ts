import type { Page } from "@playwright/test";

/**
 * Confirm buttons differ by request type: connect popups use `confirm-btn`, signature and
 * transaction popups use `confirm-footer-button`, and older builds used
 * `page-container-footer-next`. Try them together so one call covers every popup.
 */
export const approve = async (popup: Page): Promise<void> => {
  const button = popup
    .getByTestId("confirm-btn")
    .or(popup.getByTestId("confirm-footer-button"))
    .or(popup.locator('[data-testid="page-container-footer-next"]'))
    .first();
  await button.click({ timeout: 15_000 });
};

/** The cancel counterparts of `approve`, in the same order: connect, sign/tx, then the old build. */
export const reject = async (popup: Page): Promise<void> => {
  const button = popup
    .getByTestId("cancel-btn")
    .or(popup.getByTestId("confirm-footer-cancel-button"))
    .or(popup.locator('[data-testid="page-container-footer-cancel"]'))
    .first();
  await button.click({ timeout: 15_000 });
};
