import type { Page } from "@playwright/test";

import type { NetworkActions, NetworkConfig, WalletActionContext } from "../../../types";

const closeButton = (home: Page) =>
  home.getByTestId("modal-header-close-button").filter({ visible: true }).first();

const openNetworkManager = async (home: Page): Promise<void> => {
  await home.getByTestId("sort-by-networks").click();
  await closeButton(home).waitFor({ state: "visible" });
};

const add = async ({ home }: WalletActionContext, config: NetworkConfig): Promise<void> => {
  await openNetworkManager(home);

  await home.getByText("Custom", { exact: true }).first().click();
  await home.getByRole("button", { name: "Add custom network" }).first().click();

  await home.getByTestId("network-form-network-name").fill(config.name);
  await home.getByTestId("network-form-chain-id").fill(String(config.chainId));
  await home.getByTestId("network-form-ticker-input").fill(config.symbol);

  await home.getByTestId("test-add-rpc-drop-down").click();
  await home.getByText("Add RPC URL", { exact: true }).first().click();
  await home.getByTestId("rpc-url-input-test").fill(config.rpcUrl);
  await home.getByTestId("page-container-footer-next").click();

  await home.getByTestId("network-form-network-name").waitFor();
  await home.getByTestId("page-container-footer-next").click();

  await closeButton(home).click();
  await closeButton(home).waitFor({ state: "hidden" });
};

export const network: NetworkActions = {
  add,
};
