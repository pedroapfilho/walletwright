import { SOLANA_ADDRESS, SOLANA_SIGNATURE, solflareTest } from "./fixtures";

const test = solflareTest;
const { expect } = test;

test("Solflare: connect + sign on Solana", async ({ page, wallet }) => {
  await page.goto("/");

  await page.locator("#svmConnect").click();
  await wallet.connectToDapp();
  await expect(page.locator("#svmAccount")).toHaveText(SOLANA_ADDRESS);

  await page.locator("#svmSign").click();
  await wallet.confirmSignature();
  await expect(page.locator("#svmSignature")).toHaveText(SOLANA_SIGNATURE);
});
