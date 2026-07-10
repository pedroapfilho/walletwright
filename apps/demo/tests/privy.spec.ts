import { createWalletFixtures } from "walletwright";

import { metamaskSetup } from "../wallet-setup.ts";

const test = createWalletFixtures(metamaskSetup);
const { expect } = test;

const ACCOUNT = /^0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266$/i;

// Needs a real Privy app id (dashboard.privy.io) with wallet login enabled.
test.skip(!process.env.VITE_PRIVY_APP_ID, "set VITE_PRIVY_APP_ID to run the Privy spec");

test("Privy: log in with MetaMask and sign a message", async ({ page, wallet }) => {
  await page.goto("/privy.html");

  await page.getByTestId("privy-login").click();
  await page.getByRole("button", { name: /MetaMask/i }).click();

  // Privy authenticates external wallets with SIWE: a connect popup, then a personal_sign popup.
  await wallet.connectToDapp();
  await wallet.confirmSignature();
  await expect(page.getByTestId("privy-account")).toHaveText(ACCOUNT);

  await page.getByTestId("privy-sign").click();
  await wallet.confirmSignature();
  await expect(page.getByTestId("privy-signature")).toHaveText(/^0x[0-9a-fA-F]{130}$/);
});
