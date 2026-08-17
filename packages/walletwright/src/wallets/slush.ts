import type { Page } from "@playwright/test";

import { prepareWebStoreExtension } from "../internal/download";
import { createUnlockScreen } from "../internal/unlock-screen";
import { sleep, waitUntilOrThrow } from "../internal/wait";
import type { WalletDefinition } from "../types";

const SLUSH_EXTENSION_ID = "opcgpfmipidbgpenhmajoajpbobppdil";

const HOME_ROUTE = "#/tokens";

const IMPORT_HOME_TIMEOUT_MS = 30_000;

const atHome = async (page: Page): Promise<boolean> =>
  (await page.evaluate(() => globalThis.location.hash).catch(() => "")) === HOME_ROUTE;

const fclick = async (page: Page, text: string, timeoutMs = 15_000): Promise<boolean> => {
  const target = page.getByText(text, { exact: true }).first();
  const visible = await target
    .waitFor({ state: "visible", timeout: timeoutMs })
    .then(() => true)
    .catch(() => false);
  if (!visible) {
    return false;
  }
  await target.scrollIntoViewIfNeeded().catch(() => {});
  await target.click({ force: true, timeout: timeoutMs });
  return true;
};

const { reachUnlockScreen, unlock } = createUnlockScreen({
  entry: "index.html",
  isUnlocked: atHome,
  submit: async (page) => {
    await fclick(page, "Unlock");
  },
  wallet: "Slush",
});

export const slush: WalletDefinition = {
  approve: async (popup, password) => {
    await sleep(2000);
    const confirmed = (await fclick(popup, "Approve", 4000)) || (await fclick(popup, "Sign"));
    if (!confirmed) {
      throw new Error("[walletwright] Slush approval: neither Approve nor Sign was actionable");
    }
    await sleep(1500);
    const input = popup.locator('input[type="password"]');
    if (await input.isVisible().catch(() => false)) {
      await input.fill(password);
      await fclick(popup, "Unlock");
    }
  },

  ecosystems: ["sui"],

  extensionName: "Slush",

  importWallet: async (page, seedPhrase, password) => {
    await fclick(page, "More options");
    await sleep(1000);
    await fclick(page, "Import existing from passphrase");
    await sleep(1500);

    const words = seedPhrase.trim().split(/\s+/v);
    for (let i = 0; i < words.length; i++) {
      await page.getByLabel(`Word ${i + 1}`, { exact: true }).fill(words[i] ?? "");
    }
    await page.getByRole("button", { name: "Next" }).click();
    await sleep(2000);

    await page.locator('input[placeholder="Password"]').fill(password);
    await page.locator('input[placeholder="Confirm Password"]').fill(password);
    await page.getByRole("button", { name: "Next" }).click();
    await sleep(2000);

    await page
      .getByRole("button", { name: "Next" })
      .click()
      .catch(() => {});
    await waitUntilOrThrow(() => atHome(page), {
      intervalMs: 1000,
      message: `Slush import never reached the wallet home (${HOME_ROUTE})`,
      timeoutMs: IMPORT_HOME_TIMEOUT_MS,
    });
  },

  notificationMatch: "isPopup=1",

  onboardingPage: "index.html",

  prepareContext: async (context) => {
    await context.route("**://*.slush.app/**", (route) =>
      route.fulfill({
        body: JSON.stringify({ data: {} }),
        contentType: "application/json",
        status: 200,
      }),
    );
  },

  prepareExtension: (cacheDir) =>
    prepareWebStoreExtension({
      cacheDir,
      extensionId: SLUSH_EXTENSION_ID,
      name: "slush-chrome-latest",
    }),

  reachUnlockScreen,

  reject: async (popup) => {
    await sleep(2000);
    if (!(await fclick(popup, "Reject"))) {
      throw new Error("[walletwright] Slush reject: no Reject control was actionable");
    }
  },

  unlock,
};
