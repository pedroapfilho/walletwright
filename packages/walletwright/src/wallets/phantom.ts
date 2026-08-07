import { prepareWebStoreExtension } from "../internal/download";
import { createUnlockScreen } from "../internal/unlock-screen";
import { sleep } from "../internal/wait";
import type { WalletDefinition } from "../types";

// Phantom's old crx-backup host is dead; pull from the Chrome Web Store (stable extension id).
const PHANTOM_EXTENSION_ID = "bfnaelmomeimhlpmgjnjophhpkkoljpa";

const { reachUnlockScreen, unlock } = createUnlockScreen({
  entry: "popup.html",
  // Phantom reopens either locked (password screen) or straight onto the account home, which
  // carries no stable test id of its own. Actionable UI with no password field is that home; what
  // the probe rules out is the third state, a popup that rendered nothing, which used to pass as
  // "unlocked" and only surfaced later as an approval that never arrived.
  isUnlocked: async (page) => {
    const rendered = await page
      .locator("button")
      .first()
      .isVisible()
      .catch(() => false);
    return rendered;
  },
  submit: async (page, field) => {
    const unlockButton = page.getByRole("button", { name: /unlock/iv });
    await ((await unlockButton.isVisible().catch(() => false))
      ? unlockButton.click()
      : field.press("Enter"));
  },
  wallet: "Phantom",
});

export const phantom: WalletDefinition = {
  ecosystems: ["evm", "svm"],
  extensionName: "Phantom",

  // Its approval window surfaces as a page headless, verified end to end on Linux CI and macOS.
  headlessApprovals: true,

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

  reachUnlockScreen,

  unlock,

  // Connect and signature popups both confirm with `primary-button` (reject = `secondary-button`).
  approve: async (popup) => {
    await popup.getByTestId("primary-button").click({ timeout: 15_000 });
  },

  reject: async (popup) => {
    await popup.getByTestId("secondary-button").click({ timeout: 15_000 });
  },
};
