import { clicksFor } from "../internal/click";
import { sleep } from "../internal/wait";
import type { WalletDefinition } from "../types";

const { click } = clicksFor("Phantom");

export const phantom: WalletDefinition = {
  approval: {
    cancel: (popup) => popup.getByTestId("secondary-button"),
    confirm: (popup) => popup.getByTestId("primary-button"),
    headless: true,
  },

  ecosystems: ["evm", "svm"],

  extensionName: "Phantom",

  importWallet: async (page, seedPhrase, password) => {
    const testId = (id: string) => page.locator(`[data-testid="${id}"]`);

    await click(page.locator("text=I already have a wallet"));
    await sleep(1000);
    await click(page.locator("text=Import Recovery Phrase"));
    await sleep(1500);

    const words = seedPhrase.trim().split(/\s+/v);
    for (let i = 0; i < words.length; i++) {
      await testId(`secret-recovery-phrase-word-input-${i}`).fill(words[i] ?? "");
    }
    await click(testId("onboarding-form-submit-button"));

    await testId("onboarding-form-secondary-button").waitFor({ state: "visible", timeout: 60_000 });
    await click(testId("onboarding-form-submit-button"));

    await testId("onboarding-form-password-input").fill(password);
    await testId("onboarding-form-confirm-password-input").fill(password);
    await click(testId("onboarding-form-terms-of-service-checkbox"));
    await click(testId("onboarding-form-submit-button"));
    await sleep(2500);
    await sleep(1500);
  },

  onboardingPage: "onboarding.html",

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
    submit: async (page) => {
      await click(page.getByRole("button", { name: /unlock/iv }));
    },
  },
};
