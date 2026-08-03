import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";

import type { WalletSetup } from "../types";
import { wallets } from "../wallets/index";

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
 * Import the wallet once and persist an onboarded browser profile to disk (the "cache"), so tests
 * launch a ready-to-unlock wallet instead of re-running onboarding each time. Returns the profile
 * directory. Idempotent per (wallet, version, seed, password).
 *
 * `headless` only affects this build step (onboarding has no approval popups). Tests must run headed.
 */
export const buildCache = async (
  setup: WalletSetup,
  options: { headless?: boolean } = {},
): Promise<string> => {
  const definition = wallets[setup.wallet];
  const cacheDir = path.resolve(setup.cacheDir ?? DEFAULT_CACHE_DIR);
  const extensionPath = await definition.prepareExtension(cacheDir, setup.version);

  const profileDir = path.join(cacheDir, profileKey(setup));
  await rm(profileDir, { force: true, recursive: true });
  await mkdir(profileDir, { recursive: true });

  const args = [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ];
  if (options.headless === true) {
    args.push("--headless=new");
  }

  const context = await chromium.launchPersistentContext(profileDir, { args, headless: false });
  try {
    const extensionId = extensionIdFromPath(extensionPath);

    // Navigate to the onboarding entry ourselves (the extension's auto-opened tab is unreliable,
    // especially headless).
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
    // A cache that holds no wallet state is worse than a failed build: it launches, unlocks nothing,
    // and turns into a mystery failure in someone's spec. Fail here, where the cause is visible.
    await waitUntilOrThrow(() => hasPersistedState(profileDir, extensionId), {
      intervalMs: 500,
      message: `${definition.extensionName} onboarding wrote no wallet state into ${profileDir}`,
      timeoutMs: STATE_WRITE_TIMEOUT_MS,
    });
    await context.close();
    // Runs while the browser is closed (the leveldb is not locked).
    await definition.finalizeCache?.(profileDir, extensionId);
    return profileDir;
  } catch (error) {
    await context.close().catch(() => {});
    throw error;
  }
};
