import { test as base } from "@playwright/test";

import { type LaunchedWallet, launchWallet } from "./internal/launch";
import type { Wallet, WalletSetup } from "./types";

export type WalletFixtures = {
  wallet: Wallet;
};

/** One launch per test, which the `context` and `wallet` fixtures then read from. */
type LaunchFixture = {
  walletLaunch: LaunchedWallet;
};

/**
 * Build a Playwright `test` whose `context`/`page` run inside a persistent Chromium with the wallet
 * loaded and unlocked, exposing a `wallet` fixture to approve connect/sign popups.
 *
 * ```ts
 * const test = createWalletFixtures(setup);
 * test("connect", async ({ page, wallet }) => {
 *   await page.goto("/");
 *   await page.getByRole("button", { name: "Connect" }).click();
 *   await wallet.connectToDapp();
 * });
 * ```
 */
export const createWalletFixtures = (setup: WalletSetup) =>
  base.extend<LaunchFixture & WalletFixtures>({
    context: async ({ walletLaunch }, use) => {
      await use(walletLaunch.context);
    },
    wallet: async ({ walletLaunch }, use) => {
      await use(walletLaunch.wallet);
    },
    // Depends only on Playwright's `headless` option (so `--headed` and `use: { headless }` reach
    // the wallet): its own `browser` fixture would launch a second Chromium that no test ever
    // drives, since the wallet needs a persistent context of its own.
    walletLaunch: async ({ headless }, use) => {
      const launched = await launchWallet(setup, { headless });
      await use(launched);
      await launched.context.close();
    },
  });
