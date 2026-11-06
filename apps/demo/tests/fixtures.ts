import { expect, type Page } from "@playwright/test";
import { createWalletFixtures } from "@walletwright/core";
import type { Wallet } from "@walletwright/core";

import {
  metamaskSetup,
  phantomSetup,
  rabbySetup,
  slushSetup,
  solflareSetup,
  TEST_ACCOUNT,
} from "../wallet-setup";

// Playwright's default `headless: true` reaches only the wallets that support it (Phantom, Rabby);
// the fixtures launch the rest headed.
export const metamaskTest = createWalletFixtures(metamaskSetup);
export const phantomTest = createWalletFixtures(phantomSetup);
export const rabbyTest = createWalletFixtures(rabbySetup);
export const slushTest = createWalletFixtures(slushSetup);
export const solflareTest = createWalletFixtures(solflareSetup);

export const EVM_SIGNATURE = /^0x[0-9a-fA-F]{130}$/v;

export const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/v;

export const SOLANA_SIGNATURE = /^0x[0-9a-f]{128}$/v;

/** Connect the `window.ethereum` section, as every EVM spec on the public test seed starts. */
export const connectEvm = async (page: Page, wallet: Wallet): Promise<void> => {
  await page.goto("/");
  await page.locator("#connectButton").click();
  await wallet.connectToDapp();
  await expect(page.locator("#accounts")).toHaveText(TEST_ACCOUNT);
};
