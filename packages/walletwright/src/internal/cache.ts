import { readdir } from "node:fs/promises";
import path from "node:path";

import type { WalletDefinition } from "../types";

import { prepareExtension } from "./extension";
import { type EngineSetup, extensionStateDir, locateProfile, publishProfile } from "./profile";
import { openSession, type WalletSession } from "./session";
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

const onboard = async (
  definition: WalletDefinition,
  setup: EngineSetup,
  { context, extensionId, userDataDir }: WalletSession,
): Promise<void> => {
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
  await waitUntilOrThrow(() => hasPersistedState(userDataDir, extensionId), {
    intervalMs: 500,
    message: `${definition.extensionName} onboarding wrote no wallet state into ${userDataDir}`,
    timeoutMs: STATE_WRITE_TIMEOUT_MS,
  });
};

/** Build in staging and retain the prior cache until the new profile publishes successfully. */
export const build = async (
  definition: WalletDefinition,
  setup: EngineSetup,
  { headless = false }: { headless?: boolean } = {},
): Promise<string> => {
  const { cacheDir, profileDir } = await locateProfile(setup);
  const extensionPath = await prepareExtension(definition, setup, cacheDir);
  const { session } = await openSession(
    { definition, extensionPath, headless, profile: { parent: cacheDir, prefix: BUILD_PREFIX } },
    (opened) => onboard(definition, setup, opened),
  );
  await session.close(async () => {
    await definition.finalizeCache?.(session.userDataDir, session.extensionId);
    await publishProfile(session.userDataDir, profileDir);
  });
  return profileDir;
};
