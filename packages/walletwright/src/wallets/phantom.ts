import { clicksFor, isShowing } from "../internal/click";
import { sleep } from "../internal/wait";
import type { WalletDefinition } from "../types";

const PHANTOM = "Phantom";

const { click, waitShown } = clicksFor(PHANTOM);

export const phantom: WalletDefinition = {
  approval: {
    cancel: (popup) => popup.getByTestId("secondary-button"),
    confirm: (popup) => popup.getByTestId("primary-button"),
    headless: true,
  },

  ecosystems: ["evm", "svm"],

  extensionName: PHANTOM,

  importWallet: async (page, seedWords, password) => {
    const testId = (id: string) => page.locator(`[data-testid="${id}"]`);

    await click(page.locator("text=I already have a wallet"));
    await sleep(1000);
    await click(page.locator("text=Import Recovery Phrase"));
    await sleep(1500);

    for (const [index, word] of seedWords.entries()) {
      await testId(`secret-recovery-phrase-word-input-${index}`).fill(word);
    }

    await click(testId("onboarding-form-submit-button"));

    await waitShown(testId("onboarding-form-secondary-button"), { timeoutMs: 60_000 });
    await click(testId("onboarding-form-submit-button"));

    await testId("onboarding-form-password-input").fill(password);
    await testId("onboarding-form-confirm-password-input").fill(password);
    await click(testId("onboarding-form-terms-of-service-checkbox"));
    await click(testId("onboarding-form-submit-button"));
    await testId("onboarding-form-password-input").waitFor({ state: "hidden", timeout: 30_000 });
  },

  onboardingPage: "onboarding.html",

  source: { id: "bfnaelmomeimhlpmgjnjophhpkkoljpa", kind: "webStore" },

  unlockScreen: {
    entry: "popup.html",
    isUnlocked: (page) => isShowing(page.locator("button").first()),
    submit: async (page) => {
      await click(page.getByRole("button", { name: /unlock/iv }));
    },
  },
};
