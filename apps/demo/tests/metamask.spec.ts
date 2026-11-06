import { connectEvm, EVM_SIGNATURE, metamaskTest } from "./fixtures";

const test = metamaskTest;
const { expect } = test;

test("MetaMask: connect wallet and sign a message", async ({ page, wallet }) => {
  await connectEvm(page, wallet);

  await page.locator("#signButton").click();
  await wallet.confirmSignature();
  await expect(page.locator("#signature")).toHaveText(EVM_SIGNATURE);
});
