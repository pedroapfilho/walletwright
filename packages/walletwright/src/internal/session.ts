import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";

import { type BrowserContext, chromium, type Page } from "@playwright/test";

import type { WalletDefinition } from "../types";

import { downloadAndExtractExtension, type ExtensionDownload } from "./download";
import { extensionIdFromPath } from "./extension";
import { copyProfile, type ProfilePlacement } from "./profile";
import { waitUntilOrThrow } from "./wait";

const NAVIGATION_INTERVAL_MS = 1000;
const NAVIGATION_TIMEOUT_MS = 15_000;

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
  definition: Pick<WalletDefinition, "prepareContext">;
  extension: ExtensionDownload;
  headless: boolean;
  profile: ProfilePlacement;
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
  { definition, extension, headless, profile }: SessionOptions,
  start: (session: WalletSession) => Promise<Started>,
): Promise<{ session: WalletSession; started: Started }> => {
  await mkdir(profile.parent, { recursive: true });
  const userDataDir = await mkdtemp(path.join(profile.parent, profile.prefix));

  let session: WalletSession | undefined;

  try {
    if (profile.copyOf !== undefined) {
      await copyProfile(profile.copyOf, userDataDir);
    }

    const extensionPath = await downloadAndExtractExtension(extension);
    const extensionId = await extensionIdFromPath(extensionPath);

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

/**
 * Open one of the extension's own pages. A `chrome-extension://` URL fails with
 * `ERR_BLOCKED_BY_CLIENT` until the extension registers, which takes seconds after launch, so
 * reaching one is a poll rather than a one-shot.
 */
export const gotoExtensionPage = async (
  page: Page,
  { extensionId, path: pagePath, wallet }: { extensionId: string; path: string; wallet: string },
): Promise<void> => {
  const url = `chrome-extension://${extensionId}/${pagePath}`;

  await waitUntilOrThrow(
    () =>
      page
        .goto(url, { waitUntil: "domcontentloaded" })
        .then(() => true)
        .catch(() => undefined),
    {
      intervalMs: NAVIGATION_INTERVAL_MS,
      message: `${wallet} ${pagePath} never loaded (${url})`,
      timeoutMs: NAVIGATION_TIMEOUT_MS,
    },
  );
};
