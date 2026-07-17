import { createWalletFixtures } from "walletwright";

import { metamaskSetup } from "../wallet-setup.ts";

const test = createWalletFixtures(metamaskSetup);
const { expect } = test;

// Needs the local chain on 127.0.0.1:8545 (see `walletwright/chain`): the sender must hold funds
// and MetaMask reads balance, nonce, and gas off the chain to render the confirmation.
const RPC_URL = "http://127.0.0.1:8545";

const receiptStatus = async (hash: string): Promise<string | undefined> => {
  const response = await fetch(RPC_URL, {
    body: JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method: "eth_getTransactionReceipt",
      params: [hash],
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const { result } = (await response.json()) as { result?: { status?: string } };
  return result?.status;
};

test.beforeEach(async ({ page, wallet }) => {
  await page.goto("/");
  await page.locator("#connectButton").click();
  await wallet.connectToDapp();
  await page.locator("#switchChainButton").click();
  await wallet.approve();
  await expect(page.locator("#chainId")).toHaveText("0x7a69");
});

test("confirm a transaction and see it mined", async ({ page, wallet }) => {
  await page.locator("#sendTxButton").click();
  await wallet.confirmTransaction();

  const hash = page.locator("#txHash");
  await expect(hash).toHaveText(/^0x[0-9a-fA-F]{64}$/);
  // Anvil mines instantly, so the receipt is available right away.
  expect(await receiptStatus((await hash.textContent()) ?? "")).toBe("0x1");
});

test("reject a transaction", async ({ page, wallet }) => {
  await page.locator("#sendTxButton").click();
  await wallet.rejectTransaction();

  await expect(page.locator("#error")).toContainText(/reject|denied/i);
  await expect(page.locator("#txHash")).toBeEmpty();
});
