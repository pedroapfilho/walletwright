import type { BrowserContext, Page } from "@playwright/test";

import type { WalletDefinition } from "../types";

import { formatTimeout, gotoWithRetry, waitUntil } from "./wait";

const PASSWORD_FIELD = 'input[type="password"]';

const NAVIGATION_TIMEOUT_MS = 15_000;
const FIRST_SETTLE_TIMEOUT_MS = 20_000;
const RELOAD_ATTEMPTS = 5;
const RELOAD_SETTLE_TIMEOUT_MS = 5000;
const PROBE_INTERVAL_MS = 500;
const PASSWORD_CLEARED_TIMEOUT_MS = 15_000;

/**
 * Short on purpose. `unlock` is normally handed a page `reachUnlockScreen` already settled, so this
 * budget only matters when it is called on its own (the `settings.unlock` path), where a wallet with a
 * late-mounting UI needs a poll rather than a single read but a dead page should still fail fast.
 */
const UNLOCK_SETTLE_TIMEOUT_MS = 5000;

export type UnlockFlow = {
  reachUnlockScreen: (context: BrowserContext, extensionId: string) => Promise<Page>;
  /**
   * Type the password into the field `page` shows, submit it, and verify the field cleared. `unlock`
   * ends with it, and an approval window that asks for the password again goes through it too.
   */
  submitPassword: (page: Page, password: string) => Promise<void>;
  unlock: (page: Page, password: string) => Promise<void>;
};

/** Whether `page` is asking for the password right now. Reads without waiting. */
export const asksForPassword = async (page: Page): Promise<boolean> => {
  try {
    return await page.locator(PASSWORD_FIELD).first().isVisible();
  } catch {
    return false; // the page can go while we ask
  }
};

/**
 * The shared unlock flow: open the wallet's own page, wait for it to settle into a state we can
 * name, and type the password. Every wallet differs only in its `unlockScreen`: the entry page, how
 * it submits, and whether it can come back already unlocked.
 */
export const createUnlockScreen = ({
  extensionName: wallet,
  unlockScreen: { entry, isUnlocked, submit },
}: Pick<WalletDefinition, "extensionName" | "unlockScreen">): UnlockFlow => {
  const settled = async (page: Page): Promise<"locked" | "unlocked" | undefined> => {
    if (await asksForPassword(page)) {
      return "locked";
    }

    const unlocked = await isUnlocked?.(page).catch(() => false);

    return unlocked === true ? "unlocked" : undefined;
  };

  const settleWithin = (page: Page, timeoutMs: number) =>
    waitUntil(() => settled(page), { intervalMs: PROBE_INTERVAL_MS, timeoutMs });

  const reachUnlockScreen = async (context: BrowserContext, extensionId: string): Promise<Page> => {
    const page = await context.newPage();
    await gotoWithRetry(page, `chrome-extension://${extensionId}/${entry}`, {
      label: `${wallet} ${entry}`,
      timeoutMs: NAVIGATION_TIMEOUT_MS,
    });

    let state = await settleWithin(page, FIRST_SETTLE_TIMEOUT_MS);

    for (let attempt = 0; attempt < RELOAD_ATTEMPTS && state === undefined; attempt++) {
      await page.reload().catch(() => {});
      state = await settleWithin(page, RELOAD_SETTLE_TIMEOUT_MS);
    }

    if (state === undefined) {
      throw new Error(
        `[walletwright] ${wallet} never reached its unlock screen (gave up after ${formatTimeout(
          FIRST_SETTLE_TIMEOUT_MS + RELOAD_ATTEMPTS * RELOAD_SETTLE_TIMEOUT_MS,
        )})`,
      );
    }

    return page;
  };

  const submitPassword = async (page: Page, password: string): Promise<void> => {
    const field = page.locator(PASSWORD_FIELD);
    await field.fill(password);
    await (submit === undefined ? field.press("Enter") : submit(page, field));

    // A window that closes on the password, as Slush's approval does, has no field left to show.
    const cleared = await field
      .waitFor({ state: "hidden", timeout: PASSWORD_CLEARED_TIMEOUT_MS })
      .then(() => true)
      .catch(() => page.isClosed());

    if (!cleared) {
      throw new Error(
        `[walletwright] ${wallet} did not take the password (its password field was still showing after ${formatTimeout(
          PASSWORD_CLEARED_TIMEOUT_MS,
        )})`,
      );
    }
  };

  const unlock = async (page: Page, password: string): Promise<void> => {
    // Through `settleWithin`, so there is one answer to "what state is this page in" and it waits.
    const state = await settleWithin(page, UNLOCK_SETTLE_TIMEOUT_MS);

    if (state === "unlocked") {
      return;
    }

    if (state === undefined) {
      throw new Error(
        `[walletwright] ${wallet} showed neither an unlock screen nor an unlocked wallet`,
      );
    }

    await submitPassword(page, password);
  };

  return { reachUnlockScreen, submitPassword, unlock };
};
