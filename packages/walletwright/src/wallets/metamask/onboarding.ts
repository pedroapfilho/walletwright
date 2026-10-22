import type { Page } from "@playwright/test";

import { clicksFor } from "../../internal/click";
import { waitUntil } from "../../internal/wait";

const SRP_RETYPE_TIMEOUT_MS = 40_000;
const SRP_CONFIRM_TIMEOUT_MS = 5000;

const { click, clickIfShown } = clicksFor("MetaMask");

export const importWallet = async (
  page: Page,
  seedPhrase: string,
  password: string,
): Promise<void> => {
  await click(page.getByTestId("onboarding-import-wallet"));
  await click(page.getByTestId("onboarding-import-with-srp-button"));

  const srpField = page.getByTestId("srp-input-import__srp-note");
  const confirmEnabled = page.locator('[data-testid="import-srp-confirm"]:not([disabled])');

  const accepted = await waitUntil(
    async () => {
      await click(srpField);
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

  await click(confirmEnabled);

  await page.getByTestId("create-password-new-input").fill(password);
  await page.getByTestId("create-password-confirm-input").fill(password);
  await click(page.getByTestId("create-password-terms"));
  await click(page.locator('[data-testid="create-password-submit"]:not([disabled])'));

  await clickIfShown(page.getByTestId("passkey-maybe-later-button"));
  await clickIfShown(page.getByTestId("metametrics-i-agree"));
};
