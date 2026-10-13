import { cp, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";

import { type BrowserContext, chromium } from "@playwright/test";

import type { WalletDefinition } from "../types";

import { extensionIdFromPath } from "./extension";

/** Chromium running the wallet's extension on a throwaway profile directory. */
export type WalletSession = {
  /**
   * Close the browser, run `persist` on the closed profile (which may move the directory away), then
   * remove what is left of the directory, even when closing fails. Reports every failure.
   */
  close: (persist?: () => Promise<void>) => Promise<void>;
  context: BrowserContext;
  extensionId: string;
  userDataDir: string;
};

type SessionOptions = {
  definition: WalletDefinition;
  extensionPath: string;
  headless: boolean;
  /** Where the throwaway directory is created, and the profile it starts as a copy of, if any. */
  profile: { copyOf?: string; parent: string; prefix: string };
};

const removeDir = (dir: string): Promise<void> => rm(dir, { force: true, recursive: true });

const bindSession = (
  context: BrowserContext,
  extensionId: string,
  userDataDir: string,
): WalletSession => {
  const removeOnClose = async (): Promise<void> => {
    try {
      await removeDir(userDataDir);
    } catch {
      // Playwright does not await close-event listeners; `close()` owns strict cleanup.
    }
  };
  context.on("close", removeOnClose);

  const close = async (persist?: () => Promise<void>): Promise<void> => {
    context.off("close", removeOnClose);
    const errors: Array<unknown> = [];
    try {
      await context.close();
      await persist?.();
    } catch (error) {
      errors.push(error);
    }
    try {
      await removeDir(userDataDir);
    } catch (error) {
      errors.push(error);
    }

    if (errors.length > 1) {
      throw new AggregateError(
        errors,
        `[walletwright] failed to close the browser and remove ${userDataDir}`,
      );
    }
    if (errors.length === 1) {
      throw errors[0];
    }
  };

  return { close, context, extensionId, userDataDir };
};

/**
 * Open Chromium with the extension on a throwaway profile, apply `prepareContext`, and run `start`.
 * Build and run both open the wallet here, so neither can load it differently. Anything that fails
 * before `start` returns closes the browser and removes the directory.
 */
export const openSession = async <Started>(
  { definition, extensionPath, headless, profile }: SessionOptions,
  start: (session: WalletSession) => Promise<Started>,
): Promise<{ session: WalletSession; started: Started }> => {
  const extensionId = await extensionIdFromPath(extensionPath);
  const userDataDir = await mkdtemp(path.join(profile.parent, profile.prefix));

  let session: WalletSession | undefined;
  try {
    if (profile.copyOf !== undefined) {
      await cp(profile.copyOf, userDataDir, { recursive: true });
    }
    const context = await chromium.launchPersistentContext(userDataDir, {
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
      // The default headless build is the headless shell, which cannot load an extension at all.
      channel: "chromium",
      headless,
    });
    session = bindSession(context, extensionId, userDataDir);
    await definition.prepareContext?.(context);
    return { session, started: await start(session) };
  } catch (error) {
    await (session?.close() ?? removeDir(userDataDir)).catch(() => {});
    throw error;
  }
};
