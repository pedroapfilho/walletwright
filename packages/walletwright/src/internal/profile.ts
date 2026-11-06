import { createHash } from "node:crypto";
import { cp, rename, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { WalletDefinition, WalletSetup } from "../types";

import { withArtifactLock } from "./cache-lock";
import type { ExtensionDownload } from "./download";
import { extensionArchive } from "./extension";
import { pathExists, renameIfExists } from "./fs";

const DEFAULT_CACHE_DIR = ".walletwright";

const PREVIOUS_SUFFIX = ".previous";

/** A setup as the engine runs it: the public entry points have already resolved `wallet`. */
export type EngineSetup = Omit<WalletSetup, "wallet">;

/** A throwaway profile directory: where it is created, and the profile it starts as a copy of. */
export type ProfilePlacement = { copyOf?: string; parent: string; prefix: string };

/** Everything a setup puts on disk, so the build and the run cannot resolve it differently. */
type SetupLocation = {
  /**
   * Where the build onboards. Inside the cache so publishing is a `rename` on one filesystem, and
   * dot-prefixed so it can never be mistaken for a profile key.
   */
  build: ProfilePlacement;
  extension: ExtensionDownload;
  profileDir: string;
  /** Where a run unlocks: a copy of the published profile. */
  run: ProfilePlacement;
};

/** Stable profile identity: the archive names the wallet and its release, then the credentials. */
export const profileKey = (setup: EngineSetup, archiveName: string): string =>
  createHash("sha256")
    .update(`${archiveName}:${setup.seedPhrase}:${setup.password}`)
    .digest("hex")
    .slice(0, 20);

/** Resolve storage paths without reading or mutating a published profile. */
export const locate = (
  definition: Pick<WalletDefinition, "extensionName" | "source">,
  setup: EngineSetup,
): SetupLocation => {
  const archive = extensionArchive(definition, setup.version);
  const cacheDir = path.resolve(setup.cacheDir ?? DEFAULT_CACHE_DIR);
  const profileDir = path.join(cacheDir, profileKey(setup, archive.name));

  return {
    build: { parent: cacheDir, prefix: ".building-" },
    extension: { ...archive, cacheDir },
    profileDir,
    run: { copyOf: profileDir, parent: os.tmpdir(), prefix: "walletwright-" },
  };
};

/** Where Chrome persists an extension's `chrome.storage.local` inside a browser profile. */
export const extensionStateDir = (profileDir: string, extensionId: string): string =>
  path.join(profileDir, "Default", "Local Extension Settings", extensionId);

/** Where Chrome persists an extension's IndexedDB inside a browser profile. */
export const extensionIndexedDbDir = (profileDir: string, extensionId: string): string =>
  path.join(
    profileDir,
    "Default",
    "IndexedDB",
    `chrome-extension_${extensionId}_0.indexeddb.leveldb`,
  );

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
