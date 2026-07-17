import { createWalletFixtures } from "walletwright";

import { metamaskSetup } from "../wallet-setup.ts";

const test = createWalletFixtures(metamaskSetup);
const { expect } = test;

const ACCOUNT = /^0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266$/i;

// Runs only with your own Privy app id (dashboard.privy.io, wallet login enabled). The page also
// defaults to Privy's *public* test app id so `pnpm dev` works for manual clicking, but that shared
// id is heavily rate-limited — connect and the SIWE round-trip can each take tens of seconds — which
// makes an automated run too flaky to keep in CI. Point VITE_PRIVY_APP_ID at a real app to run this.
test.skip(!process.env.VITE_PRIVY_APP_ID, "set VITE_PRIVY_APP_ID to a real Privy app id to run");

// Privy authenticates an external wallet with SIWE, so login raises two popups back to back — a
// connect, then a personal_sign. Drive whatever popup is pending until the account appears rather
// than assuming a fixed order, since backend latency can reorder how quickly each arrives.
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
