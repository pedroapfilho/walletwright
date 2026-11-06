import { LOCAL_CHAIN, LOCAL_CHAIN_HEX } from "../src/requests";

import { connectEvm, EVM_SIGNATURE, metamaskTest } from "./fixtures";

const test = metamaskTest;
const { expect } = test;

test("dapp-initiated add-and-switch via wallet_addEthereumChain", async ({ page, wallet }) => {
  await connectEvm(page, wallet);

  await page.locator("#switchChainButton").click();
  await wallet.approve();
  await expect(page.locator("#chainId")).toHaveText(LOCAL_CHAIN_HEX);
});

test("wallet-UI network.add, then the dapp switches onto it", async ({ page, wallet }) => {
  await connectEvm(page, wallet);

  await wallet.network.add(LOCAL_CHAIN);

  await page.locator("#switchChainButton").click();
  await wallet.approve();
  await expect(page.locator("#chainId")).toHaveText(LOCAL_CHAIN_HEX);

  await page.locator("#signButton").click();
  await wallet.confirmSignature();
  await expect(page.locator("#signature")).toHaveText(EVM_SIGNATURE);
});
