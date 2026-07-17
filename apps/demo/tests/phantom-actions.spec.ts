import { createWalletFixtures } from "walletwright";

import { phantomSetup } from "../wallet-setup.ts";

const test = createWalletFixtures(phantomSetup);
const { expect } = test;

test("Phantom: reject an EVM connection request", async ({ page, wallet }) => {
  await page.goto("/");

  await page.locator("#phantomEvmConnect").click();
  await wallet.rejectConnection();

  await expect(page.locator("#phantomEvmError")).toContainText(/reject/i);
  await expect(page.locator("#phantomEvmAccount")).toBeEmpty();
});
