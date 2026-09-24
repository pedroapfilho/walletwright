import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import path from "node:path";

import type { BrowserContext } from "@playwright/test";

import type { WalletSetup } from "../types";
import { wallets } from "../wallets/index";

import { openWalletContext } from "./browser";
import { prepareExtension } from "./extension";
import { extensionStateDir, locateProfile, publishProfile } from "./profile";
import { gotoWithRetry, sleep, waitUntilOrThrow } from "./wait";

const NAVIGATION_TIMEOUT_MS = 15_000;
const FLUSH_SETTLE_MS = 3000;
const STATE_WRITE_TIMEOUT_MS = 10_000;

/**
 * Prefix for an in-progress build. Inside `cacheDir` so publishing is a `rename` on one filesystem,
 * dot-prefixed so it can never be mistaken for a 20-hex-character `profileKey`.
 */
const BUILD_PREFIX = ".building-";

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

/** The seams a unit test replaces, so the build can be exercised without a browser or network. */
type BuildCacheDependencies = {
  launchPersistentContext?: Parameters<typeof openWalletContext>[0]["launchPersistentContext"];
  prepareExtension: typeof prepareExtension;
};

const defaultDependencies: BuildCacheDependencies = { prepareExtension };

/** Build in staging and retain the prior cache until the new profile publishes successfully. */
const buildCacheWithDependencies = async (
  setup: WalletSetup,
  { headless = false }: { headless?: boolean } = {},
  dependencies: BuildCacheDependencies = defaultDependencies,
): Promise<string> => {
  const definition = wallets[setup.wallet];
  const { cacheDir, profileDir } = await locateProfile(setup);
  const extensionPath = await dependencies.prepareExtension(setup, cacheDir);
  await mkdir(cacheDir, { recursive: true });
  const staging = await mkdtemp(path.join(cacheDir, BUILD_PREFIX));

  let context: BrowserContext | undefined;
  try {
    const opened = await openWalletContext({
      definition,
      extensionPath,
      headless,
      launchPersistentContext: dependencies.launchPersistentContext,
      userDataDir: staging,
    });
    context = opened.context;
    const { extensionId } = opened;

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

export { buildCache, buildCacheWithDependencies };
export type { BuildCacheDependencies };
