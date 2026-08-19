import { access } from "node:fs/promises";

import { ClassicLevel } from "classic-level";
import { z } from "zod";

import { extensionStateDir } from "../../internal/utils";

const onboardingStateSchema = z.record(z.string(), z.json());

type OnboardingState = z.infer<typeof onboardingStateSchema>;

const parseState = (text: string, label: string): OnboardingState => {
  const result = onboardingStateSchema.safeParse(JSON.parse(text));
  if (!result.success) {
    throw new Error(`[walletwright] MetaMask's ${label} state is not an object`, {
      cause: result.error,
    });
  }
  return result.data;
};

const markOnboarded = (onboarding: OnboardingState) => ({
  ...onboarding,
  completedOnboarding: true,
  firstTimeFlowType:
    typeof onboarding.firstTimeFlowType === "string" ? onboarding.firstTimeFlowType : "import",
  onboardingTabs: {},
});

/** Patch both MetaMask 13.x onboarding layouts while the browser has released LevelDB. */
export const markMetaMaskOnboarded = async (
  profileDir: string,
  extensionId: string,
): Promise<void> => {
  const dbDir = extensionStateDir(profileDir, extensionId);
  try {
    await access(dbDir);
  } catch (error) {
    throw new Error(`[walletwright] MetaMask wrote no extension state to ${dbDir}`, {
      cause: error,
    });
  }

  const db = new ClassicLevel(dbDir, {
    createIfMissing: false,
    keyEncoding: "utf8",
    valueEncoding: "utf8",
  });
  try {
    await db.open();

    const perController = await db.get("OnboardingController");
    if (perController !== undefined && perController !== "") {
      const onboarding = parseState(perController, "OnboardingController");
      if (onboarding.completedOnboarding !== true) {
        await db.put("OnboardingController", JSON.stringify(markOnboarded(onboarding)));
      }
      return;
    }

    const raw = await db.get("data");
    if (raw === undefined || raw === "") {
      throw new Error(
        `[walletwright] MetaMask persisted no onboarding state in ${dbDir} (neither an OnboardingController key nor a data key)`,
      );
    }
    const state = parseState(raw, '"data"');
    const nestedResult = onboardingStateSchema.safeParse(state.data);
    const nested = nestedResult.success ? nestedResult.data : undefined;
    const controllerResult = onboardingStateSchema.safeParse(
      (nested ?? state).OnboardingController,
    );
    if (!controllerResult.success) {
      throw new Error(`[walletwright] MetaMask's "data" state holds no OnboardingController`);
    }
    const patched = markOnboarded(controllerResult.data);
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
