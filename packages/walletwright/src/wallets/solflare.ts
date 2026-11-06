import type { Page } from "@playwright/test";

import { clicksFor } from "../internal/click";
import type { WalletDefinition } from "../types";

/** Quick setup only shows once Solflare has checked the seed's accounts for SOL over the network. */
const BALANCE_CHECK_TIMEOUT_MS = 60_000;

const SOLFLARE = "Solflare";

const { click, waitShown } = clicksFor(SOLFLARE);

const importWallet = async (
  page: Page,
  seedWords: ReadonlyArray<string>,
  password: string,
): Promise<void> => {
  await click(page.getByTestId("btn-import-existing-wallet"));
  await click(page.getByText("Recovery phrase", { exact: true }).first());

  await waitShown(page.getByTestId("input-recovery-phrase-1"));

  for (const [index, word] of seedWords.entries()) {
    await page.getByTestId(`input-recovery-phrase-${index + 1}`).fill(word);
  }

  await click(page.getByTestId("btn-continue"));

  await waitShown(page.getByTestId("input-new-password"));
  await page.getByTestId("input-new-password").fill(password);
  await page.getByTestId("input-repeat-password").fill(password);
  await click(page.getByTestId("btn-continue"));

  await click(page.getByTestId("btn-quick-setup"), { timeoutMs: BALANCE_CHECK_TIMEOUT_MS });

  await click(page.getByTestId("btn-explore"));
};

export const solflare: WalletDefinition = {
  approval: {
    cancel: (popup) => popup.getByTestId("btn-cancel").or(popup.getByTestId("btn-reject")),
    confirm: (popup) => popup.getByTestId("btn-connect").or(popup.getByTestId("btn-approve")),
    urlMatch: "confirm_popup.html",
  },

  ecosystems: ["svm"],

  extensionName: SOLFLARE,

  importWallet,

  onboardingPage: "wallet.html",

  source: { id: "bhhhlbepdkbapadjdnnojkbgioiodbic", kind: "webStore" },

  unlockScreen: { entry: "wallet.html" },
};
