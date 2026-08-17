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

/** Create Playwright fixtures backed by one unlocked wallet launch per test. */
export const createWalletFixtures = (setup: WalletSetup) =>
  base.extend<LaunchFixture & WalletFixtures>({
    context: async ({ walletLaunch }, use) => {
      await use(walletLaunch.context);
    },
    wallet: async ({ walletLaunch }, use) => {
      await use(walletLaunch.wallet);
    },
    walletLaunch: async ({ headless }, use) => {
      const launched = await launchWallet(setup, { headless });
      await use(launched);
      await launched.close();
    },
  });
