import { phantomTest } from "./fixtures.ts";

const test = phantomTest;
const { expect } = test;

test("Phantom: reject an EVM connection request", async ({ page, wallet }) => {
  await page.goto("/");

  await page.locator("#phantomEvmConnect").click();
  await wallet.rejectConnection();

  await expect(page.locator("#phantomEvmError")).toContainText(/reject/i);
  await expect(page.locator("#phantomEvmAccount")).toBeEmpty();
});

test("Phantom: reject a Solana connection request", async ({ page, wallet }) => {
  await page.goto("/");
  await page.locator("#phantomSvmConnect").click();
  await wallet.rejectConnection();
  await expect(page.locator("#phantomSvmError")).toContainText(/reject/i);
  await expect(page.locator("#phantomSvmAccount")).toBeEmpty();
});
