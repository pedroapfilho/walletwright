import { passwordField } from "../../../internal/unlock-screen";
import type { SettingsActions } from "../../../types";
import { click, waitShown } from "../clicks";

export const settings: SettingsActions = {
  lock: async ({ home }) => {
    await click(home.getByTestId("account-options-menu-button"));
    await click(home.getByTestId("global-menu-lock").filter({ visible: true }).first());
    await waitShown(passwordField(home), { timeoutMs: 15_000 });
  },

  unlock: async ({ unlock }) => {
    await unlock();
  },
};
