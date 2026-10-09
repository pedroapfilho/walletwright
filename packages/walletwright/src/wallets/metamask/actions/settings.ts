import { clicksFor } from "../../../internal/click";
import type { SettingsActions } from "../../../types";

const { click } = clicksFor("MetaMask");

export const settings: SettingsActions = {
  lock: async ({ home }) => {
    await click(home.getByTestId("account-options-menu-button"));
    await click(home.getByTestId("global-menu-lock").filter({ visible: true }).first());
    await home.locator('input[type="password"]').waitFor({ state: "visible", timeout: 15_000 });
  },

  unlock: async ({ unlock }) => {
    await unlock();
  },
};
