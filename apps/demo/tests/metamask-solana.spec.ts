import { metamaskTest } from "./fixtures.ts";

const test = metamaskTest;
const { expect } = test;

// MetaMask announces a Solana wallet over the Wallet Standard (chains solana:*, standard:connect,
// solana:signMessage). The demo's MetaMask-Solana section drives it exactly like the Sui section
// drives Slush.
test("MetaMask: connect and sign on Solana", async ({ page, wallet }) => {
  await page.goto("/");

  await page.locator("#mmSvmConnect").click();
  await wallet.connectToDapp();
  // Solana addresses are base58, 32-44 chars.
  await expect(page.locator("#mmSvmAccount")).toHaveText(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);

  await page.locator("#mmSvmSign").click();
  await wallet.confirmSignature();
  // An ed25519 signature is 64 bytes, hex-encoded by the demo.
  await expect(page.locator("#mmSvmSignature")).toHaveText(/^0x[0-9a-fA-F]{128}$/);
});

test("MetaMask: reject a Solana connection request", async ({ page, wallet }) => {
  await page.goto("/");
  await page.locator("#mmSvmConnect").click();
  await wallet.rejectConnection();
  await expect(page.locator("#mmSvmError")).toContainText(/reject|denied/i);
  await expect(page.locator("#mmSvmAccount")).toBeEmpty();
});
