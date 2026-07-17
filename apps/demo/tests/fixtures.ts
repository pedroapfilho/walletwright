import type { Page } from "@playwright/test";
import { createWalletFixtures } from "walletwright";
import type { Wallet } from "walletwright";

import { metamaskSetup, phantomSetup, slushSetup } from "../wallet-setup.ts";

export const metamaskTest = createWalletFixtures(metamaskSetup);
export const phantomTest = createWalletFixtures(phantomSetup);
export const slushTest = createWalletFixtures(slushSetup);

/** The EVM baseline: open the dapp, connect MetaMask, wait for the account. */
export const connectMetamask = async (page: Page, wallet: Wallet): Promise<void> => {
  await page.goto("/");
  await page.locator("#connectButton").click();
  await wallet.connectToDapp();
  await page.locator("#accounts").waitFor();
};
