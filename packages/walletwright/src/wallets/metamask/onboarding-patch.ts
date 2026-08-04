import { existsSync } from "node:fs";

import { ClassicLevel } from "classic-level";

import { extensionStateDir } from "../../internal/utils";

type OnboardingState = Record<string, unknown>;

const asState = (value: unknown): OnboardingState | undefined =>
  typeof value === "object" && value !== null ? { ...value } : undefined;

const markOnboarded = (onboarding: OnboardingState): OnboardingState => ({
  ...onboarding,
  completedOnboarding: true,
  firstTimeFlowType:
    typeof onboarding.firstTimeFlowType === "string" ? onboarding.firstTimeFlowType : "import",
  onboardingTabs: {},
});

/**
 * Force `completedOnboarding=true` in MetaMask's persisted state so the cached wallet boots straight
 * to the unlock screen instead of getting stuck on the "wallet is ready" screen (whose "Open wallet"
 * action goes through the MV3 service worker and is unreliable under automation).
 *
 * MetaMask 13.13.x stored all state under a single `data` key; 13.3x stores each controller under its
 * own key (`OnboardingController`). Both are handled. Must run while the browser is closed.
 *
 * Every branch that can't find the state it means to patch throws: leaving the cache unpatched means
 * a wallet that boots to "wallet is ready" and ignores every dapp request, which is far harder to
 * diagnose from a spec than a failed cache build.
 */
export const markMetaMaskOnboarded = async (
  profileDir: string,
  extensionId: string,
): Promise<void> => {
  const dbDir = extensionStateDir(profileDir, extensionId);
  if (!existsSync(dbDir)) {
    throw new Error(`[walletwright] MetaMask wrote no extension state to ${dbDir}`);
  }

  const db = new ClassicLevel(dbDir, {
    createIfMissing: false,
    keyEncoding: "utf8",
    valueEncoding: "utf8",
  });
  try {
    await db.open();

    const perController = await db.get("OnboardingController").catch(() => null);
    if (perController !== null && perController !== "") {
      const onboarding = asState(JSON.parse(perController));
      if (onboarding === undefined) {
        throw new Error(`[walletwright] MetaMask's OnboardingController state is not an object`);
      }
      if (onboarding.completedOnboarding !== true) {
        await db.put("OnboardingController", JSON.stringify(markOnboarded(onboarding)));
      }
      return;
    }

    const raw = await db.get("data").catch(() => null);
    if (raw === null || raw === "") {
      throw new Error(
        `[walletwright] MetaMask persisted no onboarding state in ${dbDir} (neither an OnboardingController key nor a data key)`,
      );
    }
    const state = asState(JSON.parse(raw));
    if (state === undefined) {
      throw new Error(`[walletwright] MetaMask's "data" state is not an object`);
    }
    const nested = asState(state.data);
    const controller = asState((nested ?? state).OnboardingController);
    if (controller === undefined) {
      throw new Error(`[walletwright] MetaMask's "data" state holds no OnboardingController`);
    }
    const patched = markOnboarded(controller);
    await db.put(
      "data",
      JSON.stringify(
        nested === undefined
          ? { ...state, OnboardingController: patched }
          : { ...state, data: { ...nested, OnboardingController: patched } },
      ),
    );
  } finally {
    await db.close();
  }
};
