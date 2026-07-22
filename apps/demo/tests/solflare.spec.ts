import { solflareTest } from "./fixtures.ts";

const test = solflareTest;
const { expect } = test;

test("Solflare: connect + sign on Solana", async ({ page, wallet }) => {
  await page.goto("/");

  await page.locator("#mockSvmConnect").click();
  await wallet.connectToDapp();
  // Base58 Solana address, no 0/O/I/l.
  await expect(page.locator("#mockSvmAccount")).toHaveText(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);

  await page.locator("#mockSvmSign").click();
  await wallet.confirmSignature();
  // Ed25519 signature: 64 bytes rendered as hex.
  await expect(page.locator("#mockSvmSignature")).toHaveText(/^0x[0-9a-f]{128}$/);
});
