import type { SettingsActions } from "../../../types";
import { unlock as unlockScreen } from "../onboarding";

export const settings: SettingsActions = {
  lock: async ({ home }) => {
    await home.getByTestId("account-options-menu-button").click();
    await home.getByTestId("global-menu-lock").filter({ visible: true }).first().click();
    await home.locator('input[type="password"]').waitFor({ state: "visible", timeout: 15_000 });
  },

  unlock: async ({ home, password }) => {
    await unlockScreen(home, password);
  },
};
