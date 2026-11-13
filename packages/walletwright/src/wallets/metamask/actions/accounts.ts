import type { Page } from "@playwright/test";

import type { AccountActions, WalletActionContext } from "../../../types";
import { click, waitGone, waitShown } from "../clicks";

const openAccountMenu = async (home: Page): Promise<void> => {
  await click(home.getByTestId("account-menu-icon"));
  await waitShown(home.getByTestId("add-multichain-account-button"));
};

/** The menu is a popover with no close affordance; going home is the reliable way out. */
const closeAccountMenu = async (home: Page): Promise<void> => {
  await home.goto(`${home.url().split("#")[0]}#/`);
  await waitShown(home.getByTestId("account-menu-icon"));
};

const add = async ({ home }: WalletActionContext): Promise<void> => {
  await openAccountMenu(home);
  const cells = home.getByTestId("account-cell-avatar");
  const before = await cells.count();
  await click(home.getByTestId("add-multichain-account-button"));
  await waitShown(cells.nth(before), { timeoutMs: 15_000 });
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
  await waitShown(confirm);
  await home.locator("input").first().fill(privateKey);
  await click(confirm);
  await waitGone(confirm, { timeoutMs: 15_000 });
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
  await waitGone(home.getByTestId("add-multichain-account-button"), { timeoutMs: 10_000 });
};

export const accounts: AccountActions = {
  add,
  importPrivateKey,
  rename,
  switch: switchTo,
};
