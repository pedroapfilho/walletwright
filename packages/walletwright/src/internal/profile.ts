import { createHash } from "node:crypto";
import { rename, rm } from "node:fs/promises";
import path from "node:path";

import type { WalletSetup } from "../types";

import { pathExists, renameIfExists } from "./fs";

const DEFAULT_CACHE_DIR = ".walletwright";

const PREVIOUS_SUFFIX = ".previous";

/** Stable per-setup profile directory name, so the same wallet+seed+password reuses one cache. */
export const profileKey = (setup: WalletSetup): string =>
  createHash("sha256")
    .update(`${setup.wallet}:${setup.version ?? "default"}:${setup.seedPhrase}:${setup.password}`)
    .digest("hex")
    .slice(0, 20);

/** Where Chrome persists an extension's `chrome.storage.local` inside a browser profile. */
export const extensionStateDir = (profileDir: string, extensionId: string): string =>
  path.join(profileDir, "Default", "Local Extension Settings", extensionId);

const previousProfileDir = (profileDir: string): string => `${profileDir}${PREVIOUS_SUFFIX}`;

/** Put back a profile that an interrupted publication left at its recovery path. */
export const restorePreviousProfile = async (profileDir: string): Promise<void> => {
  const previous = previousProfileDir(profileDir);
  if (await pathExists(profileDir)) {
    await rm(previous, { force: true, recursive: true });
    return;
  }
  await renameIfExists(previous, profileDir);
};

/**
 * The cache directory and this setup's profile inside it, with any interrupted publication already
 * recovered, so building and launching both start from the same answer.
 */
export const locateProfile = async (
  setup: WalletSetup,
): Promise<{ cacheDir: string; profileDir: string }> => {
  const cacheDir = path.resolve(setup.cacheDir ?? DEFAULT_CACHE_DIR);
  const profileDir = path.join(cacheDir, profileKey(setup));
  await restorePreviousProfile(profileDir);
  return { cacheDir, profileDir };
};

/** Swap `staging` in as the profile, keeping the prior one at its recovery path until it lands. */
export const publishProfile = async (staging: string, profileDir: string): Promise<void> => {
  await restorePreviousProfile(profileDir);
  const previous = previousProfileDir(profileDir);
  const movedPrevious = await renameIfExists(profileDir, previous);

  try {
    await rename(staging, profileDir);
  } catch (error) {
    if (movedPrevious) {
      try {
        await rename(previous, profileDir);
      } catch (rollbackError) {
        const publishMessage = error instanceof Error ? error.message : String(error);
        const rollbackMessage =
          rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
        throw new Error(
          `[walletwright] failed to publish cache at ${profileDir}: ${publishMessage}; rollback failed: ${rollbackMessage}`,
          { cause: rollbackError },
        );
      }
    }
    throw error;
  }

  if (movedPrevious) {
    await rm(previous, { force: true, recursive: true });
  }
};
