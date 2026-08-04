import type { Page } from "@playwright/test";

import { createUnlockScreen } from "../../internal/unlock-screen";
import { waitUntil } from "../../internal/wait";

const SRP_RETYPE_TIMEOUT_MS = 40_000;
const SRP_CONFIRM_TIMEOUT_MS = 5000;

const { reachUnlockScreen, unlock } = createUnlockScreen({
  entry: "home.html",
  wallet: "MetaMask",
});

export const importWallet = async (
  page: Page,
  seedPhrase: string,
  password: string,
): Promise<void> => {
  await page.getByTestId("onboarding-import-wallet").click();
  await page.getByTestId("onboarding-import-with-srp-button").click();

  // The SRP field only enables the confirm button after its change handler parses a valid phrase.
  // `fill` doesn't fire those events; typing can drop keystrokes, so retype until it enables. The
  // budget bounds the retries rather than a count: one retype is ~5s of keystrokes plus the wait.
  const srpField = page.getByTestId("srp-input-import__srp-note");
  const confirmEnabled = page.locator('[data-testid="import-srp-confirm"]:not([disabled])');
  const accepted = await waitUntil(
    async () => {
      await srpField.click();
      await srpField.fill("");
      await srpField.pressSequentially(seedPhrase, { delay: 50 });
      return confirmEnabled
        .waitFor({ state: "visible", timeout: SRP_CONFIRM_TIMEOUT_MS })
        .then(() => true)
        .catch(() => undefined);
    },
    { intervalMs: 0, timeoutMs: SRP_RETYPE_TIMEOUT_MS },
  );
  if (accepted === undefined) {
    throw new Error("[walletwright] MetaMask rejected the seed phrase (confirm stayed disabled)");
  }
  await confirmEnabled.click();

  await page.getByTestId("create-password-new-input").fill(password);
  await page.getByTestId("create-password-confirm-input").fill(password);
  await page.getByTestId("create-password-terms").click();
  await page.locator('[data-testid="create-password-submit"]:not([disabled])').click();

  // Post-password steps vary by build; skip whichever isn't shown. The "wallet is ready" screen is
  // handled out of band via finalizeCache (completedOnboarding patch).
  await page
    .getByTestId("passkey-maybe-later-button")
    .click({ timeout: 10_000 })
    .catch(() => {});
  await page
    .getByTestId("metametrics-i-agree")
    .click({ timeout: 10_000 })
    .catch(() => {});
};

export { reachUnlockScreen, unlock };
