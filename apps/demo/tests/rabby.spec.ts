import { connectEvm, EVM_SIGNATURE, rabbyTest } from "./fixtures";

const test = rabbyTest;
const { expect } = test;

test("Rabby: connect wallet and sign a message", async ({ page, wallet }) => {
  await connectEvm(page, wallet);

  await page.locator("#signButton").click();
  await wallet.confirmSignature();
  await expect(page.locator("#signature")).toHaveText(EVM_SIGNATURE);
});
