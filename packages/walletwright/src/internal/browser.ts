import { type BrowserContext, chromium } from "@playwright/test";

import type { WalletDefinition } from "../types";

import { extensionIdFromPath } from "./extension";

type LaunchPersistentContext = typeof chromium.launchPersistentContext;

const launchChromium: LaunchPersistentContext = chromium.launchPersistentContext.bind(chromium);

/**
 * Launch Chromium with the wallet's extension loaded and its `prepareContext` applied. The cache
 * build and the test run both open the wallet here, so a route stubbed or an extension loaded for
 * one but not the other cannot fail far from its cause. Closes the context if preparing it fails.
 */
export const openWalletContext = async ({
  definition,
  extensionPath,
  headless,
  launchPersistentContext = launchChromium,
  userDataDir,
}: {
  definition: WalletDefinition;
  extensionPath: string;
  headless: boolean;
  /** Injected by tests; defaults to Playwright's own. */
  launchPersistentContext?: LaunchPersistentContext;
  userDataDir: string;
}): Promise<{ context: BrowserContext; extensionId: string }> => {
  const context = await launchPersistentContext(userDataDir, {
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    // The default headless build is the headless shell, which cannot load an extension at all.
    channel: "chromium",
    headless,
  });
  try {
    await definition.prepareContext?.(context);
    return { context, extensionId: await extensionIdFromPath(extensionPath) };
  } catch (error) {
    await context.close().catch(() => {});
    throw error;
  }
};
