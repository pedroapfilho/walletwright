import { connectMetamask, metamaskTest } from "./fixtures";

const test = metamaskTest;
const { expect } = test;

const LOCAL_CHAIN_HEX = "0x7a69";

test("dapp-initiated add-and-switch via wallet_addEthereumChain", async ({ page, wallet }) => {
  await connectMetamask(page, wallet);

  await page.locator("#switchChainButton").click();
  await wallet.approve();
  await expect(page.locator("#chainId")).toHaveText(LOCAL_CHAIN_HEX);
});

test("wallet-UI network.add, then the dapp switches onto it", async ({ page, wallet }) => {
  await connectMetamask(page, wallet);

  await wallet.network.add({
    chainId: 31_337,
    name: "Walletwright Local",
    rpcUrl: "http://127.0.0.1:8545",
    symbol: "ETH",
  });

  await page.locator("#switchChainButton").click();
  await wallet.approve();
  await expect(page.locator("#chainId")).toHaveText(LOCAL_CHAIN_HEX);

  await page.locator("#signButton").click();
  await wallet.confirmSignature();
  await expect(page.locator("#signature")).toHaveText(/^0x[0-9a-fA-F]{130}$/);
});
