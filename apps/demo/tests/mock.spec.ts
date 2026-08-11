import { expect, test } from "@playwright/test";
import { installMockWallet } from "@walletwright/core/mock";
import { verifyMessage } from "viem";

const ACCOUNT = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";

test("connect and sign against the mock wallet", async ({ page }) => {
  const address = await installMockWallet(page.context());
  expect(address.toLowerCase()).toBe(ACCOUNT);

  await page.goto("/");
  await page.locator("#connectButton").click();
  await expect(page.locator("#accounts")).toHaveText(new RegExp(ACCOUNT, "i"));

  await page.locator("#signButton").click();
  const signature = page.locator("#signature");
  await expect(signature).toHaveText(/^0x[0-9a-fA-F]{130}$/);

  const valid = await verifyMessage({
    address: ACCOUNT,
    message: "Hello walletwright",
    signature: ((await signature.textContent()) ?? "") as `0x${string}`,
  });
  expect(valid).toBe(true);
});
