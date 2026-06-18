import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";

import type { WalletSetup } from "../types.ts";
import { wallets } from "../wallets/index.ts";

import { DEFAULT_CACHE_DIR, extensionIdFromPath, profileKey, sleep } from "./utils.ts";

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
  if (options.headless) {
    args.push("--headless=new");
  }

  const context = await chromium.launchPersistentContext(profileDir, { args, headless: false });
  try {
    const extensionId = extensionIdFromPath(extensionPath);

    // Navigate to the onboarding entry ourselves (the extension's auto-opened tab is unreliable,
    // especially headless). Retry the navigation: right after launch the extension may not be
    // registered yet, so a chrome-extension:// URL fails with ERR_BLOCKED_BY_CLIENT.
    const page =
      context.pages().find((candidate) => candidate.url() === "about:blank") ??
      (await context.newPage());
    const url = `chrome-extension://${extensionId}/${definition.onboardingPage}`;
    let navigated = false;
    for (let attempt = 0; attempt < 15 && !navigated; attempt++) {
      navigated = await page
        .goto(url, { waitUntil: "domcontentloaded" })
        .then(() => true)
        .catch(() => false);
      if (!navigated) {
        await sleep(1000);
      }
    }
    if (!navigated) {
      throw new Error(
        `[walletwright] ${definition.extensionName} onboarding page never loaded (${url})`,
      );
    }
    await sleep(2000);

    await definition.importWallet(page, setup.seedPhrase, setup.password);
    await sleep(3000); // let the wallet flush state to disk before we close
    await context.close();
    // Runs while the browser is closed (the leveldb is not locked).
    await definition.finalizeCache?.(profileDir, extensionId);
    return profileDir;
  } catch (error) {
    await context.close().catch(() => {});
    throw error;
  }
};
