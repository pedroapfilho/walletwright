import { cp, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { BrowserContext, Page } from "@playwright/test";

import type { Wallet, WalletSetup } from "../types";
import { wallets } from "../wallets/index";

import { openWalletContext } from "./browser";
import { createWallet, runDirectly, type StepRunner } from "./controller";
import { prepareExtension } from "./extension";
import { pathExists } from "./fs";
import { locateProfile } from "./profile";
import { createUnlockScreen } from "./unlock-screen";

export type LaunchedWallet = {
  /** `close()`, so `await using launched = await launchWallet(setup)` cleans up on any exit. */
  [Symbol.asyncDispose]: () => Promise<void>;
  /**
   * Close the browser and remove the throwaway profile copy, in that order. Prefer this over
   * `context.close()`: the copy is a full onboarded profile (tens of MB), and awaiting its removal is
   * the only way to know it is gone before the process exits.
   */
  close: () => Promise<void>;
  context: BrowserContext;
  wallet: Wallet;
};

/** Close the browser, then remove the profile copy, even when closing fails; report every failure. */
const closeLaunch = async (context: BrowserContext, runDir: string): Promise<void> => {
  const errors: Array<unknown> = [];
  try {
    await context.close();
  } catch (error) {
    errors.push(error);
  }
  try {
    await rm(runDir, { force: true, recursive: true });
  } catch (error) {
    errors.push(error);
  }

  if (errors.length > 1) {
    throw new AggregateError(
      errors,
      `[walletwright] failed to close the browser and remove ${runDir}`,
    );
  }
  if (errors.length === 1) {
    throw errors[0];
  }
};

/** Close Chromium's blank tab and the extension's auto-opened tab. */
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

/** `launchWallet`, with the step runner the Playwright fixtures report wallet calls through. */
export const launch = async (
  setup: WalletSetup,
  { headless, step }: { headless: boolean; step: StepRunner },
): Promise<LaunchedWallet> => {
  const definition = wallets[setup.wallet];
  if (headless && definition.headlessApprovals !== true) {
    throw new Error(
      `[walletwright] ${definition.extensionName} has no verified headless approval flow; run this suite headed (\`use: { headless: false }\`, or \`--headed\`).`,
    );
  }
  const { cacheDir, profileDir } = await locateProfile(setup);
  if (!(await pathExists(profileDir))) {
    throw new Error(
      `[walletwright] no cache for this setup at ${profileDir}. Build it first with buildCache() or \`walletwright cache\`.`,
    );
  }
  const extensionPath = await prepareExtension(setup, cacheDir);

  /** Cleanup must cover copy and launch failures that occur before a context exists. */
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

    const opened = await openWalletContext({
      definition,
      extensionPath,
      headless,
      userDataDir: runDir,
    });
    const launched = opened.context;
    context = launched;
    launched.on("close", handleContextClose);

    const screen = createUnlockScreen(definition);
    const home = await screen.reachUnlockScreen(launched, opened.extensionId);
    const unlock = () => screen.unlock(home, setup.password);
    await unlock();
    await closeStrayPages(launched, home);

    const close = async (): Promise<void> => {
      launched.off("close", handleContextClose);
      await closeLaunch(launched, runDir);
    };
    return {
      close,
      context: launched,
      [Symbol.asyncDispose]: close,
      wallet: createWallet({
        context: launched,
        definition,
        extensionId: opened.extensionId,
        home,
        password: setup.password,
        step,
        unlock,
      }),
    };
  } catch (error) {
    context?.off("close", handleContextClose);
    await context?.close().catch(() => {});
    await removeRunDir().catch(() => {});
    throw error;
  }
};

/** Launch and unlock a disposable profile copy. Headless mode requires verified wallet support. */
export const launchWallet = (
  setup: WalletSetup,
  { headless = false }: { headless?: boolean } = {},
): Promise<LaunchedWallet> => launch(setup, { headless, step: runDirectly });

export { closeLaunch };
