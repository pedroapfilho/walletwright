import { metamaskTest, SOLANA_ADDRESS, SOLANA_SIGNATURE } from "./fixtures";

const test = metamaskTest;
const { expect } = test;

test("MetaMask: connect and sign on Solana", async ({ page, wallet }) => {
  await page.goto("/");

  await page.locator("#svmConnect").click();
  await wallet.connectToDapp();
  await expect(page.locator("#svmAccount")).toHaveText(SOLANA_ADDRESS);

  await page.locator("#svmSign").click();
  await wallet.confirmSignature();
  await expect(page.locator("#svmSignature")).toHaveText(SOLANA_SIGNATURE);
});

test("MetaMask: reject a Solana connection request", async ({ page, wallet }) => {
  await page.goto("/");
  await page.locator("#svmConnect").click();
  await wallet.rejectConnection();
  await expect(page.locator("#svmError")).toContainText(/reject|denied/i);
  await expect(page.locator("#svmAccount")).toBeEmpty();
});
