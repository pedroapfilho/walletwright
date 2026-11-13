import type { BrowserContext, Page } from "@playwright/test";

import type { LaunchedWallet, WalletDefinition } from "../types";

import { createApprovals } from "./approval";
import { createWallet, type StepRunner } from "./controller";
import { type EngineSetup, locate } from "./profile";
import { openSession } from "./session";
import { createUnlockScreen } from "./unlock-screen";

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

/** Whether the wallet's approval window surfaces as a page headless, as verified for it. */
export const runsHeadless = (definition: Pick<WalletDefinition, "approval">): boolean =>
  definition.approval.headless === true;

/**
 * Launch and unlock a disposable copy of the cached profile, reporting wallet calls through `step`.
 * Headless mode requires the definition's verified support.
 */
export const launch = async (
  definition: WalletDefinition,
  setup: EngineSetup,
  { headless, step }: { headless: boolean; step: StepRunner },
): Promise<LaunchedWallet> => {
  if (headless && !runsHeadless(definition)) {
    throw new Error(
      `[walletwright] ${definition.extensionName} has no verified headless approval flow; run this suite headed (\`use: { headless: false }\`, or \`--headed\`).`,
    );
  }

  const { extension, run } = locate(definition, setup);
  const screen = createUnlockScreen(definition, setup.password);

  const { session, started: home } = await openSession(
    { definition, extension, headless, profile: run },
    async ({ context, extensionId }) => {
      const page = await screen.reachUnlockScreen(context, extensionId);
      await screen.unlock(page);
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
        reauthenticate: screen.submitPassword,
      }),
      context: session.context,
      definition,
      extensionId: session.extensionId,
      home,
      step,
      unlock: () => screen.unlock(home),
    }),
  };
};
