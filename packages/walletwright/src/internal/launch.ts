import { existsSync } from "node:fs";
import { cp, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { type BrowserContext, chromium, type Page } from "@playwright/test";

import type { Wallet, WalletSetup } from "../types";
import { wallets } from "../wallets/index";

import { restorePreviousProfile } from "./cache";
import { extensionContextOptions } from "./chromium";
import { createWallet } from "./controller";
import { DEFAULT_CACHE_DIR, extensionIdFromPath, profileKey } from "./utils";

export type LaunchedWallet = {
  /**
   * Close the browser and remove the throwaway profile copy, in that order. Prefer this over
   * `context.close()`: the copy is a full onboarded profile (tens of MB), and awaiting its removal is
   * the only way to know it is gone before the process exits.
   */
  close: () => Promise<void>;
  context: BrowserContext;
  wallet: Wallet;
};

const closeLaunch = async (context: BrowserContext, runDir: string): Promise<void> => {
  const closed = await Promise.allSettled([context.close()]);
  const removed = await Promise.allSettled([rm(runDir, { force: true, recursive: true })]);
  const closeResult = closed[0];
  const removeResult = removed[0];

  if (closeResult?.status === "rejected" && removeResult?.status === "rejected") {
    throw new AggregateError(
      [closeResult.reason, removeResult.reason],
      `[walletwright] failed to close the browser and remove ${runDir}`,
    );
  }
  if (closeResult?.status === "rejected") {
    throw closeResult.reason;
  }
  if (removeResult?.status === "rejected") {
    throw removeResult.reason;
  }
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
 * controller. Headed by default; `headless` needs the wallet to declare `headlessApprovals`, since
 * some wallets create an approval window headless that is never exposed as a page. Outside
 * Playwright fixtures, calling `close()` is yours.
 */
export const launchWallet = async (
  setup: WalletSetup,
  { headless = false }: { headless?: boolean } = {},
): Promise<LaunchedWallet> => {
  const definition = wallets[setup.wallet];
  if (headless && definition.headlessApprovals !== true) {
    throw new Error(
      `[walletwright] ${definition.extensionName} has no verified headless approval flow; run this suite headed (\`use: { headless: false }\`, or \`--headed\`).`,
    );
  }
  const cacheDir = path.resolve(setup.cacheDir ?? DEFAULT_CACHE_DIR);
  const profileDir = path.join(cacheDir, profileKey(setup));
  await restorePreviousProfile(profileDir);
  if (!existsSync(profileDir)) {
    throw new Error(
      `[walletwright] no cache for this setup at ${profileDir}. Build it first with buildCache() or \`walletwright cache\`.`,
    );
  }

  const extensionPath = await definition.prepareExtension(cacheDir, setup.version);

  const extensionId = extensionIdFromPath(extensionPath);

  /**
   * Created before anything that can fail, and removed by exactly one owner on every exit path.
   * Binding cleanup to the context's `close` event alone is not enough: the copy and the launch below
   * can both throw before any context exists to listen on, and Playwright does not await event
   * listeners, so a rethrow can outrun the removal.
   */
  const runDir = await mkdtemp(path.join(os.tmpdir(), "walletwright-"));
  const removeRunDir = (): Promise<void> => rm(runDir, { force: true, recursive: true });
  const handleContextClose = async (): Promise<void> => {
    try {
      await removeRunDir();
    } catch {
      // Playwright does not await close-event listeners; `close()` owns strict cleanup.
    }
  };

  let context: BrowserContext | undefined;
  try {
    await cp(profileDir, runDir, { recursive: true });

    context = await chromium.launchPersistentContext(
      runDir,
      extensionContextOptions(extensionPath, headless),
    );
    const launched = context;
    launched.on("close", handleContextClose);

    await definition.prepareContext?.(launched);
    const home = await definition.reachUnlockScreen(launched, extensionId);
    await definition.unlock(home, setup.password);
    await closeStrayPages(launched, home);

    return {
      close: async () => {
        launched.off("close", handleContextClose);
        await closeLaunch(launched, runDir);
      },
      context: launched,
      wallet: createWallet({
        context: launched,
        definition,
        extensionId,
        home,
        password: setup.password,
      }),
    };
  } catch (error) {
    context?.off("close", handleContextClose);
    await context?.close().catch(() => {});
    await removeRunDir().catch(() => {});
    throw error;
  }
};

export { closeLaunch };
