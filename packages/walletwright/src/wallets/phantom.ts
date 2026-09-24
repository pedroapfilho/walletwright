import { sleep } from "../internal/wait";
import type { WalletDefinition } from "../types";

export const phantom: WalletDefinition = {
  approve: async (popup) => {
    await popup.getByTestId("primary-button").click({ timeout: 15_000 });
  },
  ecosystems: ["evm", "svm"],

  extensionName: "Phantom",

  headlessApprovals: true,

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

  reject: async (popup) => {
    await popup.getByTestId("secondary-button").click({ timeout: 15_000 });
  },

  source: { id: "bfnaelmomeimhlpmgjnjophhpkkoljpa", kind: "webStore" },

  unlockScreen: {
    entry: "popup.html",
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
  },
};
