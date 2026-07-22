import { rabbyTest } from "./fixtures.ts";

const test = rabbyTest;
const { expect } = test;

const ACCOUNT = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";

test("Rabby: connect wallet and sign a message", async ({ page, wallet }) => {
  await page.goto("/");

  await page.locator("#connectButton").click();
  await wallet.connectToDapp();
  await expect(page.locator("#accounts")).toHaveText(ACCOUNT);

  await page.locator("#signButton").click();
  await wallet.confirmSignature();
  await expect(page.locator("#signature")).toHaveText(/^0x[0-9a-fA-F]{130}$/);
});
