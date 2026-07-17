import { createWalletFixtures } from "walletwright";

import { metamaskSetup } from "../wallet-setup.ts";

const test = createWalletFixtures(metamaskSetup);
const { expect } = test;

// Well-known accounts derived from the public test mnemonic (anvil/hardhat defaults).
const ACCOUNT_2_SHORT = "0x70997...c79C8";
const ACCOUNT_3_KEY = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";
const ACCOUNT_3_SHORT = "0x3C44C...293BC";

test("add, rename, and switch accounts", async ({ wallet }) => {
  const { home } = wallet;

  await wallet.accounts.add();
  await home.getByTestId("account-menu-icon").click();
  await expect(home.getByText(ACCOUNT_2_SHORT)).toBeVisible();
  await home.goto(`${home.url().split("#")[0]}#/`);

  await wallet.accounts.switch(1);
  await expect(home.getByTestId("account-menu-icon")).toContainText("Account 2");

  await wallet.accounts.rename({ index: 1, name: "Renamed by walletwright" });
  await expect(home.getByTestId("account-menu-icon")).toContainText("Renamed by walletwright");
});

test("import an account from a private key", async ({ wallet }) => {
  const { home } = wallet;

  await wallet.accounts.importPrivateKey(ACCOUNT_3_KEY);
  await home.getByTestId("account-menu-icon").click();
  await expect(home.getByText(ACCOUNT_3_SHORT)).toBeVisible();
});
