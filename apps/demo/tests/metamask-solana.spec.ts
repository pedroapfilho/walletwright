import { metamaskTest } from "./fixtures";

const test = metamaskTest;
const { expect } = test;

test("MetaMask: connect and sign on Solana", async ({ page, wallet }) => {
  await page.goto("/");

  await page.locator("#mmSvmConnect").click();
  await wallet.connectToDapp();
  await expect(page.locator("#mmSvmAccount")).toHaveText(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);

  await page.locator("#mmSvmSign").click();
  await wallet.confirmSignature();
  await expect(page.locator("#mmSvmSignature")).toHaveText(/^0x[0-9a-fA-F]{128}$/);
});

test("MetaMask: reject a Solana connection request", async ({ page, wallet }) => {
  await page.goto("/");
  await page.locator("#mmSvmConnect").click();
  await wallet.rejectConnection();
  await expect(page.locator("#mmSvmError")).toContainText(/reject|denied/i);
  await expect(page.locator("#mmSvmAccount")).toBeEmpty();
});
