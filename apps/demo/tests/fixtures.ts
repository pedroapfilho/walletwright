import type { Page } from "@playwright/test";
import { createWalletFixtures, wallets } from "@walletwright/core";
import type { Wallet, WalletSetup } from "@walletwright/core";

import {
  metamaskSetup,
  phantomSetup,
  rabbySetup,
  slushSetup,
  solflareSetup,
} from "../wallet-setup";

/** Derive browser mode from the wallet's verified headless approval support. */
const walletTest = (setup: WalletSetup) =>
  createWalletFixtures(setup).extend({
    headless: [wallets[setup.wallet].headlessApprovals === true, { scope: "worker" }],
  });

export const metamaskTest = walletTest(metamaskSetup);
export const phantomTest = walletTest(phantomSetup);
export const rabbyTest = walletTest(rabbySetup);
export const slushTest = walletTest(slushSetup);
export const solflareTest = walletTest(solflareSetup);

/** The shared EVM connect baseline reused across specs. */
export const connectMetamask = async (page: Page, wallet: Wallet): Promise<void> => {
  await page.goto("/");
  await page.locator("#connectButton").click();
  await wallet.connectToDapp();
  await page.locator("#accounts").waitFor();
};
