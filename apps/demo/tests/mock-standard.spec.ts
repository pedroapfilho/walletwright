import { createPublicKey, verify } from "node:crypto";

import { expect, test } from "@playwright/test";
import { installMockStandardWallet } from "@walletwright/core/mock-standard";

import { SOLANA_MESSAGE } from "../src/requests";

import { SOLANA_ADDRESS, SOLANA_SIGNATURE } from "./fixtures";

const SPKI_ED25519_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

const publicKeyFromRawHex = (rawHex: string) =>
  createPublicKey({
    format: "der",
    key: Buffer.concat([SPKI_ED25519_PREFIX, Buffer.from(rawHex, "hex")]),
    type: "spki",
  });

test("connect and sign against the Wallet-Standard Solana mock", async ({ page }) => {
  const { address, publicKeyHex } = await installMockStandardWallet(page);
  expect(address).toMatch(SOLANA_ADDRESS);

  await page.goto("/");
  await page.locator("#svmConnect").click();
  await expect(page.locator("#svmAccount")).toHaveText(address);

  await page.locator("#svmSign").click();
  const signatureLocator = page.locator("#svmSignature");
  await expect(signatureLocator).toHaveText(SOLANA_SIGNATURE);

  const signatureHex = ((await signatureLocator.textContent()) ?? "").replace(/^0x/v, "");
  const signature = Buffer.from(signatureHex, "hex");
  expect(signature).toHaveLength(64);

  const message = new TextEncoder().encode(SOLANA_MESSAGE);
  expect(verify(null, message, publicKeyFromRawHex(publicKeyHex), signature)).toBe(true);
});
