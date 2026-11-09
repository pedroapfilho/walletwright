import { expect, test } from "@playwright/test";
import { installMockWallet } from "@walletwright/core/mock";
import { verifyMessage } from "viem";

import { TEST_ACCOUNT } from "../wallet-setup";

import { EVM_SIGNATURE } from "./fixtures";

test("connect and sign against the mock wallet", async ({ page }) => {
  const address = await installMockWallet(page.context());
  expect(address.toLowerCase()).toBe(TEST_ACCOUNT);

  await page.goto("/");
  await page.locator("#connectButton").click();
  await expect(page.locator("#accounts")).toHaveText(new RegExp(TEST_ACCOUNT, "iv"));

  await page.locator("#signButton").click();
  const signature = page.locator("#signature");
  await expect(signature).toHaveText(EVM_SIGNATURE);

  const valid = await verifyMessage({
    address: TEST_ACCOUNT,
    message: await page.locator("#message").inputValue(),
    signature: ((await signature.textContent()) ?? "") as `0x${string}`,
  });

  expect(valid).toBe(true);
});
