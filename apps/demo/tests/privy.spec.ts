import { metamaskTest } from "./fixtures";

const test = metamaskTest;
const { expect } = test;

const ACCOUNT = /^0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266$/i;

test.skip(!process.env.VITE_PRIVY_APP_ID, "set VITE_PRIVY_APP_ID (or apps/demo/.env) to run");

test("Privy: log in with MetaMask and sign a message", async ({ page, wallet }) => {
  test.setTimeout(180_000);
  await page.goto("/privy.html");

  await page.getByTestId("privy-login").click();
  await page.getByRole("button", { name: /MetaMask/i }).click();

  const account = page.getByTestId("privy-account");
  await expect(async () => {
    await wallet.approve({ optional: true });
    await expect(account).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 150_000 });
  await expect(account).toHaveText(ACCOUNT);

  await page.getByTestId("privy-sign").click();
  await wallet.confirmSignature();
  await expect(page.getByTestId("privy-signature")).toHaveText(/^0x[0-9a-fA-F]{130}$/);
});
