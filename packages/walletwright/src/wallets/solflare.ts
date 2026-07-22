import type { BrowserContext, Page } from "@playwright/test";

import { prepareWebStoreExtension } from "../internal/download.ts";
import type { WalletDefinition } from "../types.ts";

// Solflare. Pulled from the Chrome Web Store. No manifest `key`, so its id is path-derived.
const SOLFLARE_EXTENSION_ID = "bhhhlbepdkbapadjdnnojkbgioiodbic";

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

  // An unfunded seed derives no "active" (SOL-holding) accounts, so Solflare asks how to pick them.
  // Quick setup takes the default account, which is the one the tests drive.
  await page.getByTestId("btn-quick-setup").click({ timeout: 60_000 });

  // "You're All Set!" - accepting here is what leaves onboarding in a completed state.
  await page.getByTestId("btn-explore").click({ timeout: 60_000 });
};

const reachUnlockScreen = async (context: BrowserContext, extensionId: string): Promise<Page> => {
  const page = await context.newPage();
  const password = page.locator('input[type="password"]');
  await page.goto(`chrome-extension://${extensionId}/wallet.html`).catch(() => {});
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
    throw new Error("[walletwright] Solflare unlock screen never appeared");
  }
  return page;
};

const unlock = async (page: Page, password: string): Promise<void> => {
  const input = page.locator('input[type="password"]');
  await input.fill(password);
  await input.press("Enter");
  const cleared = await input
    .waitFor({ state: "hidden", timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  if (!cleared) {
    throw new Error(
      "[walletwright] Solflare unlock failed (password screen still visible after 15s)",
    );
  }
};

export const solflare: WalletDefinition = {
  // Connect popups confirm with `btn-connect`, signature popups with `btn-approve`; a popup renders
  // exactly one of them, so the union resolves whichever is present.
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

  // Approvals open in their own confirm_popup.html window.
  notificationMatch: "confirm_popup.html",

  onboardingPage: "wallet.html",

  // Latest from the Web Store, so `version` is ignored.
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
