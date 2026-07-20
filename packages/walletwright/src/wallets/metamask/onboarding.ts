import type { BrowserContext, Page } from "@playwright/test";

/** Fill the password field on an already-open unlock screen and wait for it to go away. */
export const unlock = async (page: Page, password: string): Promise<void> => {
  const input = page.locator('input[type="password"]');
  await input.fill(password);
  await input.press("Enter");
  const cleared = await page
    .locator('input[type="password"]')
    .waitFor({ state: "hidden", timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  if (!cleared) {
    throw new Error("[walletwright] MetaMask unlock failed (password screen still visible after 15s)");
  }
};

export const importWallet = async (
  page: Page,
  seedPhrase: string,
  password: string,
): Promise<void> => {
  await page.getByTestId("onboarding-import-wallet").click();
  await page.getByTestId("onboarding-import-with-srp-button").click();

  // The SRP field only enables the confirm button after its change handler parses a valid phrase.
  // `fill` doesn't fire those events; typing can drop keystrokes, so type, then retry until enabled.
  const srpField = page.getByTestId("srp-input-import__srp-note");
  const confirmEnabled = page.locator('[data-testid="import-srp-confirm"]:not([disabled])');
  let accepted = false;
  for (let attempt = 0; attempt < 3 && !accepted; attempt++) {
    await srpField.click();
    await srpField.fill("");
    await srpField.pressSequentially(seedPhrase, { delay: 50 });
    accepted = await confirmEnabled
      .waitFor({ state: "visible", timeout: 5000 })
      .then(() => true)
      .catch(() => false);
  }
  if (!accepted) {
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

export const reachUnlockScreen = async (
  context: BrowserContext,
  extensionId: string,
): Promise<Page> => {
  const page = await context.newPage();
  const password = page.locator('input[type="password"]');
  await page.goto(`chrome-extension://${extensionId}/home.html`);
  // The MV3 service worker needs a few seconds to restore the vault; be patient, then reload
  // (re-goto resets the page before the worker responds).
  let ready = await password
    .waitFor({ state: "visible", timeout: 20_000 })
    .then(() => true)
    .catch(() => false);
  for (let attempt = 0; attempt < 5 && !ready; attempt++) {
    await page.reload().catch(() => {});
    ready = await password
      .waitFor({ state: "visible", timeout: 5000 })
      .then(() => true)
      .catch(() => false);
  }
  if (!ready) {
    throw new Error("[walletwright] MetaMask unlock screen never appeared");
  }
  return page;
};
