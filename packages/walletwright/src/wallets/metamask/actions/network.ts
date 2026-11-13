import type { Page } from "@playwright/test";

import { showing } from "../../../internal/click";
import type { NetworkActions, WalletActionContext } from "../../../internal/definition";
import type { NetworkConfig } from "../../../types";
import { click, waitGone, waitShown } from "../clicks";

const closeButton = (home: Page) => showing(home.getByTestId("modal-header-close-button"));

const openNetworkManager = async (home: Page): Promise<void> => {
  await click(home.getByTestId("sort-by-networks"));
  await waitShown(closeButton(home));
};

const add = async ({ home }: WalletActionContext, config: NetworkConfig): Promise<void> => {
  await openNetworkManager(home);

  await click(home.getByText("Custom", { exact: true }).first());
  await click(home.getByRole("button", { name: "Add custom network" }).first());

  await home.getByTestId("network-form-network-name").fill(config.name);
  await home.getByTestId("network-form-chain-id").fill(String(config.chainId));
  await home.getByTestId("network-form-ticker-input").fill(config.symbol);

  await click(home.getByTestId("test-add-rpc-drop-down"));
  await click(home.getByText("Add RPC URL", { exact: true }).first());
  await home.getByTestId("rpc-url-input-test").fill(config.rpcUrl);
  await click(home.getByTestId("page-container-footer-next"));

  await waitShown(home.getByTestId("network-form-network-name"));
  await click(home.getByTestId("page-container-footer-next"));

  await click(closeButton(home));
  await waitGone(closeButton(home));
};

export const network: NetworkActions = {
  add,
};
