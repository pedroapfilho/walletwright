import { test as base } from "@playwright/test";

import type { StepRunner } from "./internal/controller";
import { type LaunchedWallet, launch } from "./internal/launch";
import type { Wallet, WalletSetup } from "./types";
import { wallets } from "./wallets/index";

export type WalletFixtures = {
  wallet: Wallet;
};

/** One launch per test, which the `context` and `wallet` fixtures then read from. */
type LaunchFixture = {
  walletLaunch: LaunchedWallet;
};

/**
 * Report each wallet call as a boxed step, named after it (`wallet.confirmSignature`) and failing at
 * the spec line that made the call. Not `async`: an extra awaiting frame would become that location.
 */
const reportAsStep: StepRunner = (title, body) => base.step(title, body, { box: true });

/**
 * Create Playwright fixtures backed by one unlocked wallet launch per test. `headless` applies only
 * to wallets that can be driven that way (Phantom, Rabby); the rest launch headed, so a suite runs
 * under Playwright's defaults. `launchWallet` is the strict form that refuses them headless instead.
 */
export const createWalletFixtures = (setup: WalletSetup) => {
  const definition = wallets[setup.wallet];
  return base.extend<LaunchFixture & WalletFixtures>({
    context: [
      async ({ walletLaunch }, use) => {
        await use(walletLaunch.context);
      },
      { box: true, scope: "test" },
    ],
    wallet: [
      async ({ walletLaunch }, use) => {
        await use(walletLaunch.wallet);
      },
      { box: true },
    ],
    walletLaunch: [
      async ({ headless }, use) => {
        const launched = await launch(setup, {
          headless: headless && definition.headlessApprovals === true,
          step: reportAsStep,
        });
        await use(launched);
        await launched.close();
      },
      { title: `launch ${definition.extensionName}` },
    ],
  });
};
