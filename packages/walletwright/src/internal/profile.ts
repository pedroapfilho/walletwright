import { createHash } from "node:crypto";
import { cp, rename, rm } from "node:fs/promises";
import path from "node:path";

import type { WalletSetup } from "../types";

import { withArtifactLock } from "./cache-lock";
import { pathExists, renameIfExists } from "./fs";

const DEFAULT_CACHE_DIR = ".walletwright";

const PREVIOUS_SUFFIX = ".previous";

/**
 * A setup as the engine runs it. The public entry points resolve `wallet` to its definition, so from
 * there on it only names the cache, and any definition can drive the engine.
 */
export type EngineSetup = Omit<WalletSetup, "wallet"> & { wallet: string };

/** Stable profile identity for the resolved release and credentials. */
export const profileKey = (setup: EngineSetup, archiveName: string): string =>
  createHash("sha256")
    .update(`${setup.wallet}:${archiveName}:${setup.seedPhrase}:${setup.password}`)
    .digest("hex")
    .slice(0, 20);

/** Where Chrome persists an extension's `chrome.storage.local` inside a browser profile. */
export const extensionStateDir = (profileDir: string, extensionId: string): string =>
  path.join(profileDir, "Default", "Local Extension Settings", extensionId);

const previousProfileDir = (profileDir: string): string => `${profileDir}${PREVIOUS_SUFFIX}`;

/** Put back a profile that an interrupted publication left at its recovery path. */
const restorePreviousProfile = async (profileDir: string): Promise<void> => {
  const previous = previousProfileDir(profileDir);
  if (await pathExists(profileDir)) {
    await rm(previous, { force: true, recursive: true });
    return;
  }
  await renameIfExists(previous, profileDir);
};

/** Resolve storage paths without reading or mutating a published profile. */
export const locateProfile = (setup: EngineSetup, archiveName: string) => {
  const cacheDir = path.resolve(setup.cacheDir ?? DEFAULT_CACHE_DIR);
  return { cacheDir, profileDir: path.join(cacheDir, profileKey(setup, archiveName)) };
};

/** Recover and copy one complete generation while excluding publication. */
export const copyProfile = (profileDir: string, destination: string): Promise<void> =>
  withArtifactLock(profileDir, async () => {
    await restorePreviousProfile(profileDir);
    if (!(await pathExists(profileDir))) {
      throw new Error(
        `[walletwright] no cache for this setup at ${profileDir}. Build it first with buildCache() or \`walletwright cache\`.`,
      );
    }
    await cp(profileDir, destination, { recursive: true });
  });

/** Swap `staging` in as the profile, keeping the prior one at its recovery path until it lands. */
export const publishProfile = (staging: string, profileDir: string): Promise<void> =>
  withArtifactLock(profileDir, async () => {
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
  });
