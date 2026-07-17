import { connectMetamask, metamaskTest } from "./fixtures.ts";

const test = metamaskTest;
const { expect } = test;

// These specs need the local chain running on 127.0.0.1:8545 with chain id 31337 (see
// `walletwright/chain`). MetaMask validates a custom network's RPC before saving it.
const LOCAL_CHAIN_HEX = "0x7a69";

test("dapp-initiated add-and-switch via wallet_addEthereumChain", async ({ page, wallet }) => {
  await connectMetamask(page, wallet);

  await page.locator("#switchChainButton").click();
  // MetaMask confirms the add and the switch in a single popup.
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

  // The chain already exists in the wallet, so this add request acts as a switch. It still raises
  // an approval popup (with a third-party notice the first time), so demand one: the optional
  // window is shorter than the popup's spawn latency after the wallet's own UI has been driven.
  await page.locator("#switchChainButton").click();
  await wallet.approve();
  await expect(page.locator("#chainId")).toHaveText(LOCAL_CHAIN_HEX);

  // The wallet stays usable after driving its own UI: sign to prove the popup engine still works.
  await page.locator("#signButton").click();
  await wallet.confirmSignature();
  await expect(page.locator("#signature")).toHaveText(/^0x[0-9a-fA-F]{130}$/);
});
