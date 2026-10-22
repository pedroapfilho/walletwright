import os from "node:os";

import type { BrowserContext, Page } from "@playwright/test";

import type { Wallet, WalletDefinition } from "../types";

import { createApprovals } from "./approval";
import { createWallet, type StepRunner } from "./controller";
import { extensionArchive } from "./extension";
import { type EngineSetup, locateProfile } from "./profile";
import { openSession } from "./session";
import { createUnlockScreen } from "./unlock-screen";

const RUN_PREFIX = "walletwright-";

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

/**
 * Launch and unlock a disposable copy of the cached profile, reporting wallet calls through `step`.
 * Headless mode requires the definition's verified support.
 */
export const launch = async (
  definition: WalletDefinition,
  setup: EngineSetup,
  { headless, step }: { headless: boolean; step: StepRunner },
): Promise<LaunchedWallet> => {
  if (headless && definition.approval.headless !== true) {
    throw new Error(
      `[walletwright] ${definition.extensionName} has no verified headless approval flow; run this suite headed (\`use: { headless: false }\`, or \`--headed\`).`,
    );
  }

  const archive = extensionArchive(definition, setup);
  const { cacheDir, profileDir } = locateProfile(setup, archive.name);
  const screen = createUnlockScreen(definition);

  const { session, started: home } = await openSession(
    {
      definition,
      extension: { ...archive, cacheDir },
      headless,
      profile: { copyOf: profileDir, parent: os.tmpdir(), prefix: RUN_PREFIX },
    },
    async ({ context, extensionId }) => {
      const page = await screen.reachUnlockScreen(context, extensionId);
      await screen.unlock(page, setup.password);
      await closeStrayPages(context, page);

      return page;
    },
  );

  const close = (): Promise<void> => session.close();

  return {
    close,
    context: session.context,
    [Symbol.asyncDispose]: close,
    wallet: createWallet({
      approvals: createApprovals({
        context: session.context,
        definition,
        extensionId: session.extensionId,
        reauthenticate: (popup) => screen.submitPassword(popup, setup.password),
      }),
      context: session.context,
      definition,
      extensionId: session.extensionId,
      home,
      password: setup.password,
      step,
      unlock: () => screen.unlock(home, setup.password),
    }),
  };
};
