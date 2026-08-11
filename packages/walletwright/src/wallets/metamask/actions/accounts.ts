import type { Page } from "@playwright/test";

import type { AccountActions, WalletActionContext } from "../../../types";

const openAccountMenu = async (home: Page): Promise<void> => {
  await home.getByTestId("account-menu-icon").click();
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
  await home.getByTestId("add-multichain-account-button").click();
  await cells.nth(before).waitFor({ state: "visible", timeout: 15_000 });
  await closeAccountMenu(home);
};

const importPrivateKey = async (
  { home }: WalletActionContext,
  privateKey: string,
): Promise<void> => {
  await openAccountMenu(home);
  await home.getByTestId("account-list-add-wallet-button").click();
  const chooseImport = home.getByTestId("choose-wallet-type-import-account");
  await chooseImport.waitFor({ state: "visible" });
  await chooseImport.click();
  const confirm = home.getByTestId("import-account-confirm-button");
  await confirm.waitFor({ state: "visible" });
  await home.locator("input").first().fill(privateKey);
  await confirm.click();
  await confirm.waitFor({ state: "hidden", timeout: 15_000 });
  await closeAccountMenu(home);
};

const rename = async (
  { home }: WalletActionContext,
  options: { index: number; name: string },
): Promise<void> => {
  await openAccountMenu(home);
  await home.getByTestId("multichain-account-cell-end-accessory").nth(options.index).click();
  await home.getByTestId("multichain-account-menu-item-rename").click();
  await home.getByTestId("account-name-input").locator("input").fill(options.name);
  await home.getByRole("button", { name: "Confirm" }).click();
  await closeAccountMenu(home);
};

const switchTo = async ({ home }: WalletActionContext, index: number): Promise<void> => {
  await openAccountMenu(home);
  await home.getByTestId("account-cell-avatar").nth(index).click();
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
