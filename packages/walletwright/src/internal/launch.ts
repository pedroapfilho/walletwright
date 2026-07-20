import { existsSync } from "node:fs";
import { cp, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { type BrowserContext, chromium, type Page } from "@playwright/test";

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
 * Drop the tabs nobody drives: Chromium's initial `about:blank` and the extension's own auto-opened
 * tab. We navigate a tab of our own to the wallet instead of adopting that one (it's unreliable, see
 * `reachUnlockScreen`), which otherwise leaves a second, still-locked wallet tab open all run.
 * Approval popups are unaffected: they're matched by URL, not by being the only extension page.
 */
const closeStrayPages = async (context: BrowserContext, home: Page): Promise<void> => {
  const isStray = (page: Page): boolean =>
    page !== home &&
    !page.isClosed() &&
    (page.url() === "about:blank" || page.url().startsWith("chrome-extension://"));

  const closing: Array<Promise<void>> = [];
  for (const page of context.pages()) {
    if (isStray(page)) {
      closing.push(page.close());
    }
  }
  await Promise.allSettled(closing);
};

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

  // The throwaway profile copy is only needed while the context is live; drop it on close so a long
  // suite (workers x specs x retries) doesn't fill the temp dir with profile copies.
  context.on("close", async () => {
    await rm(runDir, { force: true, recursive: true }).catch(() => {});
  });

  const extensionId = extensionIdFromPath(extensionPath);

  try {
    // Kept open (not closed after unlock): the settings/network/account actions drive this page.
    const home = await definition.reachUnlockScreen(context, extensionId);
    await definition.unlock(home, setup.password);
    await closeStrayPages(context, home);

    return {
      context,
      wallet: createWallet({ context, definition, extensionId, home, password: setup.password }),
    };
  } catch (error) {
    // Fires the context.on("close") handler above, which removes the throwaway runDir.
    await context.close().catch(() => {});
    throw error;
  }
};

/** Standalone launcher (outside Playwright fixtures). Remember to `context.close()` when done. */
export const launchWallet = launchWalletContext;
