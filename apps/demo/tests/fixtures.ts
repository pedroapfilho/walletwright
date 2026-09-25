import type { Page } from "@playwright/test";
import { createWalletFixtures } from "@walletwright/core";
import type { Wallet } from "@walletwright/core";

import {
  metamaskSetup,
  phantomSetup,
  rabbySetup,
  slushSetup,
  solflareSetup,
} from "../wallet-setup";

// Playwright's default `headless: true` reaches only the wallets that support it (Phantom, Rabby);
// the fixtures launch the rest headed.
export const metamaskTest = createWalletFixtures(metamaskSetup);
export const phantomTest = createWalletFixtures(phantomSetup);
export const rabbyTest = createWalletFixtures(rabbySetup);
export const slushTest = createWalletFixtures(slushSetup);
export const solflareTest = createWalletFixtures(solflareSetup);

/** The shared EVM connect baseline reused across specs. */
export const connectMetamask = async (page: Page, wallet: Wallet): Promise<void> => {
  await page.goto("/");
  await page.locator("#connectButton").click();
  await wallet.connectToDapp();
  await page.locator("#accounts").waitFor();
};
