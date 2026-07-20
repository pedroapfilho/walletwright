import { prepareWebStoreExtension } from "../internal/download.ts";
import { sleep } from "../internal/utils.ts";
import type { WalletDefinition } from "../types.ts";

// Phantom's old crx-backup host is dead; pull from the Chrome Web Store (stable extension id).
const PHANTOM_EXTENSION_ID = "bfnaelmomeimhlpmgjnjophhpkkoljpa";

export const phantom: WalletDefinition = {
  ecosystems: ["evm", "svm"],
  extensionName: "Phantom",

  // Phantom only publishes "latest" via the Web Store, so `version` is ignored.
  importWallet: async (page, seedPhrase, password) => {
    const testId = (id: string) => page.locator(`[data-testid="${id}"]`);

    await page.locator("text=I already have a wallet").click();
    await sleep(1000);
    await page.locator("text=Import Recovery Phrase").click();
    await sleep(1500);

    const words = seedPhrase.trim().split(/\s+/v);
    for (let i = 0; i < words.length; i++) {
      await testId(`secret-recovery-phrase-word-input-${i}`).fill(words[i] ?? "");
    }
    await testId("onboarding-form-submit-button").click();

    // "import accounts" success screen → continue
    await testId("onboarding-form-secondary-button").waitFor({ state: "visible", timeout: 60_000 });
    await testId("onboarding-form-submit-button").click();

    await testId("onboarding-form-password-input").fill(password);
    await testId("onboarding-form-confirm-password-input").fill(password);
    await testId("onboarding-form-terms-of-service-checkbox").click();
    await testId("onboarding-form-submit-button").click();
    await sleep(2500);

    const getStarted = page.locator("text=Get Started");
    if (await getStarted.isVisible().catch(() => false)) {
      await getStarted.click();
    }
    await sleep(1500);
  },

  onboardingPage: "onboarding.html",

  prepareExtension: (cacheDir) =>
    prepareWebStoreExtension({
      cacheDir,
      extensionId: PHANTOM_EXTENSION_ID,
      name: "phantom-chrome-latest",
    }),

  reachUnlockScreen: async (context, extensionId) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    const password = page.locator('input[type="password"]');
    // Either the unlock screen appears (locked) or the wallet is already unlocked, both are fine.
    for (let attempt = 0; attempt < 6; attempt++) {
      if (await password.isVisible().catch(() => false)) {
        break;
      }
      await sleep(1000);
    }
    return page;
  },

  unlock: async (page, password) => {
    const input = page.locator('input[type="password"]');
    if (!(await input.isVisible().catch(() => false))) {
      return; // already unlocked
    }
    await input.fill(password);
    const unlockButton = page.getByRole("button", { name: /unlock/iv });
    await ((await unlockButton.isVisible().catch(() => false))
      ? unlockButton.click()
      : input.press("Enter"));
    await sleep(1500);
  },

  // Connect and signature popups both confirm with `primary-button` (reject = `secondary-button`).
  approve: async (popup) => {
    await popup.getByTestId("primary-button").click({ timeout: 15_000 });
  },

  reject: async (popup) => {
    await popup.getByTestId("secondary-button").click({ timeout: 15_000 });
  },
};
