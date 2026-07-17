import { phantomTest } from "./fixtures.ts";

const test = phantomTest;
const { expect } = test;

test("Phantom: connect + sign on EVM and Solana", async ({ page, wallet }) => {
  await page.goto("/");

  // --- EVM (window.phantom.ethereum) ---
  await page.locator("#phantomEvmConnect").click();
  await wallet.connectToDapp();
  await expect(page.locator("#phantomEvmAccount")).toHaveText(/^0x[0-9a-fA-F]{40}$/);

  await page.locator("#phantomEvmSign").click();
  await wallet.confirmSignature();
  await expect(page.locator("#phantomEvmSignature")).toHaveText(/^0x[0-9a-fA-F]{130}$/);

  // --- Solana / SVM (window.phantom.solana) ---
  await page.locator("#phantomSvmConnect").click();
  await wallet.connectToDapp(); // Phantom may auto-approve an already-trusted site
  await expect(page.locator("#phantomSvmAccount")).not.toBeEmpty();

  await page.locator("#phantomSvmSign").click();
  await wallet.confirmSignature();
  await expect(page.locator("#phantomSvmSignature")).toHaveText(/^0x[0-9a-fA-F]+$/);
});
