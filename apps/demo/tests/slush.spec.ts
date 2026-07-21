import { slushTest } from "./fixtures.ts";

const test = slushTest;
const { expect } = test;

test("Slush: connect + sign on Sui", async ({ page, wallet }) => {
  await page.goto("/");

  await page.locator("#suiConnect").click();
  await wallet.connectToDapp();
  await expect(page.locator("#suiAccount")).toHaveText(/^0x[0-9a-fA-F]+$/);

  await page.locator("#suiSign").click();
  await wallet.confirmSignature();
  await expect(page.locator("#suiSignature")).not.toBeEmpty();
});

test("Slush: reject a signature request", async ({ page, wallet }) => {
  await page.goto("/");

  await page.locator("#suiConnect").click();
  await wallet.connectToDapp();
  await expect(page.locator("#suiAccount")).toHaveText(/^0x[0-9a-fA-F]+$/);

  await page.locator("#suiSign").click();
  await wallet.rejectSignature();
  await expect(page.locator("#suiError")).not.toBeEmpty();
  await expect(page.locator("#suiSignature")).toBeEmpty();
});
