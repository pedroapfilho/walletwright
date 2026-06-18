import { existsSync } from "node:fs";
import { cp, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { type BrowserContext, chromium } from "@playwright/test";

import type { Wallet, WalletSetup } from "../types.ts";
import { wallets } from "../wallets/index.ts";

import { createWallet } from "./controller.ts";
import { DEFAULT_CACHE_DIR, extensionIdFromPath, profileKey } from "./utils.ts";

export type LaunchedWallet = {
  context: BrowserContext;
  wallet: Wallet;
};

const launchArgs = (extensionPath: string): Array<string> => [
  `--disable-extensions-except=${extensionPath}`,
  // Required: current Chromium does NOT auto-load the cached unpacked extension without this.
  `--load-extension=${extensionPath}`,
];

/**
 * Launch a fresh persistent context from the onboarded cache and return an unlocked wallet
 * controller. Runs headed, extension approval popups don't open in headless Chromium (use a
 * virtual display such as xvfb on CI).
 */
export const launchWalletContext = async (setup: WalletSetup): Promise<LaunchedWallet> => {
  const definition = wallets[setup.wallet];
  const cacheDir = path.resolve(setup.cacheDir ?? DEFAULT_CACHE_DIR);
  const profileDir = path.join(cacheDir, profileKey(setup));
  if (!existsSync(profileDir)) {
    throw new Error(
      `[walletwright] no cache for this setup at ${profileDir}. Build it first with buildCache() or \`walletwright cache\`.`,
    );
  }

  const extensionPath = await definition.prepareExtension(cacheDir, setup.version);

  // Run from a throwaway copy so the cache stays pristine and parallel runs don't share a profile.
  const runDir = await mkdtemp(path.join(os.tmpdir(), "walletwright-"));
  await cp(profileDir, runDir, { recursive: true });

  const context = await chromium.launchPersistentContext(runDir, {
    args: launchArgs(extensionPath),
    headless: false,
  });

  const extensionId = extensionIdFromPath(extensionPath);

  const home = await definition.reachUnlockScreen(context, extensionId);
  await definition.unlock(home, setup.password);

  return { context, wallet: createWallet(context, definition, extensionId, setup.password) };
};

/** Standalone launcher (outside Playwright fixtures). Remember to `context.close()` when done. */
export const launchWallet = launchWalletContext;
