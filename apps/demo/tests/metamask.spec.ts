import { connectMetamask, metamaskTest } from "./fixtures.ts";

const test = metamaskTest;
const { expect } = test;

const ACCOUNT = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";

test("MetaMask: connect wallet and sign a message", async ({ page, wallet }) => {
  await connectMetamask(page, wallet);
  await expect(page.locator("#accounts")).toHaveText(ACCOUNT);

  await page.locator("#signButton").click();
  await wallet.confirmSignature();
  await expect(page.locator("#signature")).toHaveText(/^0x[0-9a-fA-F]{130}$/);
});
