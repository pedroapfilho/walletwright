import type { Page } from "@playwright/test";

import { prepareWebStoreExtension } from "../internal/download";
import { createUnlockScreen } from "../internal/unlock-screen";
import type { WalletDefinition } from "../types";

const SOLFLARE_EXTENSION_ID = "bhhhlbepdkbapadjdnnojkbgioiodbic";

const { reachUnlockScreen, unlock } = createUnlockScreen({
  entry: "wallet.html",
  wallet: "Solflare",
});

const importWallet = async (page: Page, seedPhrase: string, password: string): Promise<void> => {
  await page.getByTestId("btn-import-existing-wallet").click({ timeout: 30_000 });
  await page.getByText("Recovery phrase", { exact: true }).first().click({ timeout: 30_000 });

  const words = seedPhrase.trim().split(/\s+/v);
  await page.getByTestId("input-recovery-phrase-1").waitFor({ state: "visible", timeout: 30_000 });
  for (let index = 0; index < words.length; index++) {
    await page.getByTestId(`input-recovery-phrase-${index + 1}`).fill(words[index] ?? "");
  }
  await page.getByTestId("btn-continue").click({ timeout: 30_000 });

  await page.getByTestId("input-new-password").waitFor({ state: "visible", timeout: 30_000 });
  await page.getByTestId("input-new-password").fill(password);
  await page.getByTestId("input-repeat-password").fill(password);
  await page.getByTestId("btn-continue").click({ timeout: 30_000 });

  await page.getByTestId("btn-quick-setup").click({ timeout: 60_000 });

  await page.getByTestId("btn-explore").click({ timeout: 60_000 });
};

export const solflare: WalletDefinition = {
  approve: async (popup) => {
    await popup
      .getByTestId("btn-connect")
      .or(popup.getByTestId("btn-approve"))
      .first()
      .click({ timeout: 30_000 });
  },

  ecosystems: ["svm"],

  extensionName: "Solflare",

  importWallet,

  notificationMatch: "confirm_popup.html",

  onboardingPage: "wallet.html",

  prepareExtension: (cacheDir) =>
    prepareWebStoreExtension({
      cacheDir,
      extensionId: SOLFLARE_EXTENSION_ID,
      name: "solflare-chrome-latest",
    }),

  reachUnlockScreen,

  reject: async (popup) => {
    await popup
      .getByTestId("btn-cancel")
      .or(popup.getByTestId("btn-reject"))
      .first()
      .click({ timeout: 30_000 });
  },

  unlock,
};
