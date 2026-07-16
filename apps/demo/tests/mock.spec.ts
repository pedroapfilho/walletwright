import { expect, test } from "@playwright/test";
import { verifyMessage } from "viem";
import { installMockWallet } from "walletwright/mock";

// The mock needs no extension, so this is a plain @playwright/test spec, not a wallet fixture.
const ACCOUNT = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";

test("connect and sign against the mock wallet", async ({ page }) => {
  const address = await installMockWallet(page.context());
  expect(address.toLowerCase()).toBe(ACCOUNT);

  await page.goto("/");
  await page.locator("#connectButton").click();
  // The dapp renders the checksummed address the mock returns.
  await expect(page.locator("#accounts")).toHaveText(new RegExp(ACCOUNT, "i"));

  await page.locator("#signButton").click();
  const signature = page.locator("#signature");
  await expect(signature).toHaveText(/^0x[0-9a-fA-F]{130}$/);

  // The signature is real: it recovers to the mock's account.
  const valid = await verifyMessage({
    address: ACCOUNT,
    message: "Hello walletwright",
    signature: ((await signature.textContent()) ?? "") as `0x${string}`,
  });
  expect(valid).toBe(true);
});
