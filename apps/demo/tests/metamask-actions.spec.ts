import { createWalletFixtures } from "walletwright";

import { metamaskSetup } from "../wallet-setup.ts";

const test = createWalletFixtures(metamaskSetup);
const { expect } = test;

const ACCOUNT = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";

test("MetaMask: reject a connection request", async ({ page, wallet }) => {
  await page.goto("/");

  await page.locator("#connectButton").click();
  await wallet.rejectConnection();

  await expect(page.locator("#error")).toContainText(/reject/i);
  await expect(page.locator("#accounts")).toBeEmpty();
});

test("MetaMask: reject a signature request", async ({ page, wallet }) => {
  await page.goto("/");

  await page.locator("#connectButton").click();
  await wallet.connectToDapp();
  await expect(page.locator("#accounts")).toHaveText(ACCOUNT);

  await page.locator("#signButton").click();
  await wallet.rejectSignature();

  await expect(page.locator("#error")).toContainText(/reject/i);
  await expect(page.locator("#signature")).toBeEmpty();
});

test("MetaMask: lock and unlock the wallet", async ({ wallet }) => {
  const password = wallet.home.locator('input[type="password"]');

  await wallet.settings.lock();
  await expect(password).toBeVisible();

  await wallet.settings.unlock();
  await expect(password).toBeHidden();
});
