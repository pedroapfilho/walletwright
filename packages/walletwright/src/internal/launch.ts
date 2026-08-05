import { existsSync } from "node:fs";
import { cp, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { type BrowserContext, chromium, type Page } from "@playwright/test";

import type { Wallet, WalletSetup } from "../types";
import { wallets } from "../wallets/index";

import { extensionContextOptions } from "./chromium";
import { createWallet } from "./controller";
import { DEFAULT_CACHE_DIR, extensionIdFromPath, profileKey } from "./utils";

export type LaunchedWallet = {
  context: BrowserContext;
  wallet: Wallet;
};

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
 * controller. Headed by default; `headless` needs the wallet to declare a `notificationPage`, since
 * a headless approval window may never surface as a page for the engine to drive. Outside Playwright
 * fixtures, `context.close()` is yours.
 */
export const launchWallet = async (
  setup: WalletSetup,
  { headless = false }: { headless?: boolean } = {},
): Promise<LaunchedWallet> => {
  const definition = wallets[setup.wallet];
  // Without a `notificationPage` a headless run reaches no approval at all, and would fail 30s
  // later at the first connect with nothing pointing back at the mode as the cause.
  if (headless && definition.notificationPage === undefined) {
    throw new Error(
      `[walletwright] ${definition.extensionName} has no verified headless approval flow; run this suite headed (\`use: { headless: false }\`, or \`--headed\`).`,
    );
  }
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

  const context = await chromium.launchPersistentContext(
    runDir,
    extensionContextOptions(extensionPath, headless),
  );

  // The throwaway profile copy is only needed while the context is live; drop it on close so a long
  // suite (workers x specs x retries) doesn't fill the temp dir with profile copies.
  context.on("close", async () => {
    await rm(runDir, { force: true, recursive: true }).catch(() => {});
  });

  const extensionId = extensionIdFromPath(extensionPath);

  try {
    await definition.prepareContext?.(context);
    // Kept open (not closed after unlock): the settings/network/account actions drive this page.
    const home = await definition.reachUnlockScreen(context, extensionId);
    await definition.unlock(home, setup.password);
    await closeStrayPages(context, home);

    return {
      context,
      wallet: createWallet({
        // Headless, a wallet's approval window may be created without ever surfacing as a page
        // (MetaMask), so the controller opens this entry itself when it finds no window to drive.
        approvalPage: headless ? definition.notificationPage : undefined,
        context,
        definition,
        extensionId,
        home,
        password: setup.password,
      }),
    };
  } catch (error) {
    // Fires the context.on("close") handler above, which removes the throwaway runDir.
    await context.close().catch(() => {});
    throw error;
  }
};
