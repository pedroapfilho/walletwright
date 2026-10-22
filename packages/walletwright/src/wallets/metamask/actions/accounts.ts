import type { Page } from "@playwright/test";

import { clicksFor } from "../../../internal/click";
import type { AccountActions, WalletActionContext } from "../../../types";

const { click } = clicksFor("MetaMask");

const openAccountMenu = async (home: Page): Promise<void> => {
  await click(home.getByTestId("account-menu-icon"));
  await home.getByTestId("add-multichain-account-button").waitFor({ state: "visible" });
};

/** The menu is a popover with no close affordance; going home is the reliable way out. */
const closeAccountMenu = async (home: Page): Promise<void> => {
  await home.goto(`${home.url().split("#")[0]}#/`);
  await home.getByTestId("account-menu-icon").waitFor({ state: "visible" });
};

const add = async ({ home }: WalletActionContext): Promise<void> => {
  await openAccountMenu(home);
  const cells = home.getByTestId("account-cell-avatar");
  const before = await cells.count();
  await click(home.getByTestId("add-multichain-account-button"));
  await cells.nth(before).waitFor({ state: "visible", timeout: 15_000 });
  await closeAccountMenu(home);
};

const importPrivateKey = async (
  { home }: WalletActionContext,
  privateKey: string,
): Promise<void> => {
  await openAccountMenu(home);
  await click(home.getByTestId("account-list-add-wallet-button"));
  await click(home.getByTestId("choose-wallet-type-import-account"));
  const confirm = home.getByTestId("import-account-confirm-button");
  await confirm.waitFor({ state: "visible" });
  await home.locator("input").first().fill(privateKey);
  await click(confirm);
  await confirm.waitFor({ state: "hidden", timeout: 15_000 });
  await closeAccountMenu(home);
};

const rename = async (
  { home }: WalletActionContext,
  options: { index: number; name: string },
): Promise<void> => {
  await openAccountMenu(home);
  await click(home.getByTestId("multichain-account-cell-end-accessory").nth(options.index));
  await click(home.getByTestId("multichain-account-menu-item-rename"));
  await home.getByTestId("account-name-input").locator("input").fill(options.name);
  await click(home.getByRole("button", { name: "Confirm" }));
  await closeAccountMenu(home);
};

const switchTo = async ({ home }: WalletActionContext, index: number): Promise<void> => {
  await openAccountMenu(home);
  await click(home.getByTestId("account-cell-avatar").nth(index));

  const menuClosed = await home
    .getByTestId("add-multichain-account-button")
    .waitFor({ state: "hidden", timeout: 10_000 })
    .then(() => true)
    .catch(() => false);

  if (!menuClosed) {
    throw new Error(`[walletwright] accounts.switch(${index}) did not switch (menu stayed open)`);
  }
};

export const accounts: AccountActions = {
  add,
  importPrivateKey,
  rename,
  switch: switchTo,
};
