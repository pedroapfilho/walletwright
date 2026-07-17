import { existsSync } from "node:fs";
import path from "node:path";

import { ClassicLevel } from "classic-level";

type OnboardingState = {
  [key: string]: unknown;
  completedOnboarding?: boolean;
  firstTimeFlowType?: string;
};

const markOnboarded = (onboarding: OnboardingState): OnboardingState => ({
  ...onboarding,
  completedOnboarding: true,
  firstTimeFlowType: onboarding.firstTimeFlowType ?? "import",
  onboardingTabs: {},
});

/**
 * Force `completedOnboarding=true` in MetaMask's persisted state so the cached wallet boots straight
 * to the unlock screen instead of getting stuck on the "wallet is ready" screen (whose "Open wallet"
 * action goes through the MV3 service worker and is unreliable under automation).
 *
 * MetaMask 13.13.x stored all state under a single `data` key; 13.3x stores each controller under its
 * own key (`OnboardingController`). Both are handled. Must run while the browser is closed.
 */
export const markMetaMaskOnboarded = async (
  profileDir: string,
  extensionId: string,
): Promise<void> => {
  const dbDir = path.join(profileDir, "Default", "Local Extension Settings", extensionId);
  if (!existsSync(dbDir)) {
    return;
  }

  const db = new ClassicLevel<string, string>(dbDir, {
    createIfMissing: false,
    keyEncoding: "utf8",
    valueEncoding: "utf8",
  });
  try {
    await db.open();

    const perController = await db.get("OnboardingController").catch(() => null);
    if (perController) {
      const onboarding = JSON.parse(perController) as OnboardingState;
      if (!onboarding.completedOnboarding) {
        await db.put("OnboardingController", JSON.stringify(markOnboarded(onboarding)));
      }
      return;
    }

    const raw = await db.get("data").catch(() => null);
    if (!raw) {
      return;
    }
    const state = JSON.parse(raw) as { data?: Record<string, OnboardingState> } & Record<
      string,
      OnboardingState
    >;
    const root = state.data ?? state;
    if (root.OnboardingController) {
      root.OnboardingController = markOnboarded(root.OnboardingController);
      await db.put("data", JSON.stringify(state));
    }
  } finally {
    await db.close();
  }
};
