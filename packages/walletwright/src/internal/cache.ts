import { mkdir, mkdtemp, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";

import type { WalletDefinition, WalletSetup } from "../types";
import { wallets } from "../wallets/index";

import { extensionContextOptions } from "./chromium";
import { DEFAULT_CACHE_DIR, extensionIdFromPath, extensionStateDir, profileKey } from "./utils";
import { gotoWithRetry, sleep, waitUntilOrThrow } from "./wait";

const NAVIGATION_TIMEOUT_MS = 15_000;
const FLUSH_SETTLE_MS = 3000;
const STATE_WRITE_TIMEOUT_MS = 10_000;

/** Wallet state may live in `chrome.storage.local` or extension IndexedDB. */
const hasPersistedState = async (profileDir: string, extensionId: string): Promise<boolean> => {
  const stores = [
    extensionStateDir(profileDir, extensionId),
    path.join(
      profileDir,
      "Default",
      "IndexedDB",
      `chrome-extension_${extensionId}_0.indexeddb.leveldb`,
    ),
  ];
  const listings = await Promise.allSettled(stores.map((dir) => readdir(dir)));
  return listings.some((listing) => listing.status === "fulfilled" && listing.value.length > 0);
};

/**
 * Prefix for an in-progress build. Inside `cacheDir` so publishing is a `rename` on one filesystem,
 * dot-prefixed so it can never be mistaken for a 20-hex-character `profileKey`.
 */
const BUILD_PREFIX = ".building-";
const PREVIOUS_SUFFIX = ".previous";

const pathExists = async (target: string): Promise<boolean> => {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
};

const previousProfileDir = (profileDir: string): string => `${profileDir}${PREVIOUS_SUFFIX}`;

const restorePreviousProfile = async (profileDir: string): Promise<void> => {
  const previous = previousProfileDir(profileDir);
  if (await pathExists(profileDir)) {
    await rm(previous, { force: true, recursive: true });
    return;
  }
  try {
    await rename(previous, profileDir);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }
};

const publishProfile = async (staging: string, profileDir: string): Promise<void> => {
  await restorePreviousProfile(profileDir);
  const previous = previousProfileDir(profileDir);
  let movedPrevious = false;
  try {
    await rename(profileDir, previous);
    movedPrevious = true;
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }

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

/** Build in staging and retain the prior cache until the new profile publishes successfully. */
type BuildCacheDependencies = {
  launchPersistentContext: typeof chromium.launchPersistentContext;
  prepareExtension: (
    definition: WalletDefinition,
    cacheDir: string,
    version?: string,
  ) => Promise<string>;
};

const defaultBuildCacheDependencies: BuildCacheDependencies = {
  launchPersistentContext: chromium.launchPersistentContext.bind(chromium),
  prepareExtension: (definition, cacheDir, version) =>
    definition.prepareExtension(cacheDir, version),
};

const buildCacheWithDependencies = async (
  setup: WalletSetup,
  options: { headless?: boolean } = {},
  dependencies: BuildCacheDependencies = defaultBuildCacheDependencies,
): Promise<string> => {
  const definition = wallets[setup.wallet];
  const cacheDir = path.resolve(setup.cacheDir ?? DEFAULT_CACHE_DIR);
  const extensionPath = await dependencies.prepareExtension(definition, cacheDir, setup.version);

  const profileDir = path.join(cacheDir, profileKey(setup));
  await restorePreviousProfile(profileDir);
  await mkdir(cacheDir, { recursive: true });
  const staging = await mkdtemp(path.join(cacheDir, BUILD_PREFIX));

  let context;
  try {
    context = await dependencies.launchPersistentContext(
      staging,
      extensionContextOptions(extensionPath, options.headless === true),
    );
    await definition.prepareContext?.(context);
    const extensionId = await extensionIdFromPath(extensionPath);

    const page =
      context.pages().find((candidate) => candidate.url() === "about:blank") ??
      (await context.newPage());
    await gotoWithRetry(page, `chrome-extension://${extensionId}/${definition.onboardingPage}`, {
      label: `${definition.extensionName} onboarding page`,
      timeoutMs: NAVIGATION_TIMEOUT_MS,
    });
    await sleep(2000);

    await definition.importWallet(page, setup.seedPhrase, setup.password);
    await sleep(FLUSH_SETTLE_MS); // let the wallet flush state to disk before we close
    await waitUntilOrThrow(() => hasPersistedState(staging, extensionId), {
      intervalMs: 500,
      message: `${definition.extensionName} onboarding wrote no wallet state into ${staging}`,
      timeoutMs: STATE_WRITE_TIMEOUT_MS,
    });
    await context.close();
    await definition.finalizeCache?.(staging, extensionId);

    await publishProfile(staging, profileDir);
    return profileDir;
  } catch (error) {
    await context?.close().catch(() => {});
    throw error;
  } finally {
    await rm(staging, { force: true, recursive: true });
  }
};

const buildCache = (setup: WalletSetup, options?: { headless?: boolean }): Promise<string> =>
  buildCacheWithDependencies(setup, options);

export { buildCache, buildCacheWithDependencies, publishProfile, restorePreviousProfile };
export type { BuildCacheDependencies };
