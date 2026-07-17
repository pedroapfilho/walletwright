import type { Page } from "@playwright/test";

import type { NetworkActions, NetworkConfig, WalletActionContext } from "../../../types.ts";

const closeButton = (home: Page) =>
  home.getByTestId("modal-header-close-button").filter({ visible: true }).first();

const openNetworkManager = async (home: Page): Promise<void> => {
  await home.bringToFront();
  await home.getByTestId("sort-by-networks").click();
  // The manager is a modal; its close button is present whether the Popular or Custom tab is shown.
  await closeButton(home).waitFor({ state: "visible" });
};

const add = async ({ home }: WalletActionContext, config: NetworkConfig): Promise<void> => {
  await openNetworkManager(home);

  // The custom-network form lives behind the "Custom" tab; "Add custom network" opens the form.
  await home.getByText("Custom", { exact: true }).first().click();
  await home.getByRole("button", { name: "Add custom network" }).first().click();

  await home.getByTestId("network-form-network-name").fill(config.name);
  await home.getByTestId("network-form-chain-id").fill(String(config.chainId));
  await home.getByTestId("network-form-ticker-input").fill(config.symbol);

  // The RPC URL is a nested sub-form: open the dropdown, add a URL, fill it, confirm.
  await home.getByTestId("test-add-rpc-drop-down").click();
  await home.getByText("Add RPC URL", { exact: true }).first().click();
  await home.getByTestId("rpc-url-input-test").fill(config.rpcUrl);
  await home.getByTestId("page-container-footer-next").click();

  await home.getByTestId("network-form-network-name").waitFor();
  await home.getByTestId("page-container-footer-next").click();

  // Saving returns to the manager modal; close it so the wallet is left on a clean home screen.
  await closeButton(home).click();
  await closeButton(home).waitFor({ state: "hidden" });
};

// No `switch`: MetaMask 13.x scopes the active chain per dapp and has no wallet-side selector
// (the network manager is an asset filter; toggling a site's permitted networks doesn't change its
// active chain, verified empirically). Switching is dapp-initiated (EIP-3326
// `wallet_switchEthereumChain`), and `wallet.approve()` drives the popup when one appears.
export const network: NetworkActions = {
  add,
};
