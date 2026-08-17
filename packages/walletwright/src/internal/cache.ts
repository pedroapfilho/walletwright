import { mkdir, mkdtemp, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";

import type { WalletSetup } from "../types";
import { wallets } from "../wallets/index";

import { extensionContextOptions } from "./chromium";
import { DEFAULT_CACHE_DIR, extensionIdFromPath, extensionStateDir, profileKey } from "./utils";
import { gotoWithRetry, sleep, waitUntilOrThrow } from "./wait";

const NAVIGATION_TIMEOUT_MS = 15_000;
const FLUSH_SETTLE_MS = 3000;
const STATE_WRITE_TIMEOUT_MS = 10_000;

/**
 * Chrome stores an extension's `chrome.storage.local` under `Local Extension Settings/<id>` and its
 * IndexedDB (what some single-page wallets persist their vault to) under
 * `IndexedDB/chrome-extension_<id>_0…`. Bytes in either one mean onboarding actually landed in the
 * profile; bytes in neither mean the "cache" is empty, and every later run would fail at unlock with
 * no hint that the build was the thing that went wrong.
 */
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

const isErrorCode = (error: unknown, code: string): boolean =>
  error instanceof Error && "code" in error && error.code === code;

const pathExists = async (target: string): Promise<boolean> => {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if (isErrorCode(error, "ENOENT")) {
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
    if (!isErrorCode(error, "ENOENT")) {
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
    if (!isErrorCode(error, "ENOENT")) {
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

/**
 * Import the wallet once and persist an onboarded browser profile to disk (the "cache"), so tests
 * launch a ready-to-unlock wallet instead of re-running onboarding each time. Returns the profile
 * directory. Idempotent per (wallet, version, seed, password).
 *
 * Onboarding runs against a staging directory. Publication keeps the prior profile under a stable
 * recovery path until the staged profile lands, so a failed publish restores it and the next call
 * recovers it after an interrupted process.
 *
 * `headless` only affects this build step; the tests choose their own mode via `launchWallet`.
 */
const buildCache = async (
  setup: WalletSetup,
  options: { headless?: boolean } = {},
): Promise<string> => {
  const definition = wallets[setup.wallet];
  const cacheDir = path.resolve(setup.cacheDir ?? DEFAULT_CACHE_DIR);
  const extensionPath = await definition.prepareExtension(cacheDir, setup.version);

  const profileDir = path.join(cacheDir, profileKey(setup));
  await restorePreviousProfile(profileDir);
  await mkdir(cacheDir, { recursive: true });
  const staging = await mkdtemp(path.join(cacheDir, BUILD_PREFIX));

  let context;
  try {
    context = await chromium.launchPersistentContext(
      staging,
      extensionContextOptions(extensionPath, options.headless === true),
    );
    await definition.prepareContext?.(context);
    const extensionId = extensionIdFromPath(extensionPath);

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

export { buildCache, publishProfile, restorePreviousProfile };
