import { createPublicKey, verify } from "node:crypto";

import { expect, test } from "@playwright/test";
import { installMockStandardWallet } from "@walletwright/core/mock-standard";

const SPKI_ED25519_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

const publicKeyFromRawHex = (rawHex: string) =>
  createPublicKey({
    format: "der",
    key: Buffer.concat([SPKI_ED25519_PREFIX, Buffer.from(rawHex, "hex")]),
    type: "spki",
  });

test("connect and sign against the Wallet-Standard Solana mock", async ({ page }) => {
  const { address, publicKeyHex } = await installMockStandardWallet(page, { ecosystem: "svm" });
  expect(address).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);

  await page.goto("/");
  await page.locator("#mockSvmConnect").click();
  await expect(page.locator("#mockSvmAccount")).toHaveText(address);

  await page.locator("#mockSvmSign").click();
  const signatureLocator = page.locator("#mockSvmSignature");
  await expect(signatureLocator).toHaveText(/^0x[0-9a-fA-F]{128}$/);

  const signatureHex = ((await signatureLocator.textContent()) ?? "").replace(/^0x/v, "");
  const signature = Buffer.from(signatureHex, "hex");
  expect(signature).toHaveLength(64);

  const message = new TextEncoder().encode("Hello walletwright Mock Solana");
  expect(verify(null, message, publicKeyFromRawHex(publicKeyHex), signature)).toBe(true);
});
