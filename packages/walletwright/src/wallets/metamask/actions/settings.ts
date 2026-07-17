import type { SettingsActions } from "../../../types.ts";
import { unlock as unlockScreen } from "../onboarding.ts";

export const settings: SettingsActions = {
  lock: async ({ home }) => {
    await home.getByTestId("account-options-menu-button").click();
    // The menu renders the item several times (responsive variants), only one of which is visible.
    await home.getByTestId("global-menu-lock").filter({ visible: true }).first().click();
    await home.locator('input[type="password"]').waitFor({ state: "visible", timeout: 15_000 });
  },

  unlock: async ({ home, password }) => {
    await unlockScreen(home, password);
  },
};
