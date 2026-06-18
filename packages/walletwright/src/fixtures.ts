import { test as base } from "@playwright/test";

import { launchWalletContext } from "./internal/launch.ts";
import type { Wallet, WalletSetup } from "./types.ts";

export type WalletFixtures = {
  wallet: Wallet;
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
export const createWalletFixtures = (setup: WalletSetup) => {
  // Handoff from the (overridden) context fixture to the wallet fixture within a worker.
  let current: Wallet | undefined;

  return base.extend<WalletFixtures>({
    context: async ({ browser: _browser }, use) => {
      const { context, wallet } = await launchWalletContext(setup);
      current = wallet;
      await use(context);
      await context.close();
      current = undefined;
    },
    page: async ({ context }, use) => {
      await use(await context.newPage());
    },
    wallet: async ({ context: _context }, use) => {
      if (!current) {
        throw new Error("[walletwright] wallet fixture used before the context was initialized");
      }
      await use(current);
    },
  });
};
