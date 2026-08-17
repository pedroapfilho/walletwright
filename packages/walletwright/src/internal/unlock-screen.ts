import type { BrowserContext, Locator, Page } from "@playwright/test";

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

type UnlockScreenOptions = {
  /** Extension-relative page that renders the unlock screen (e.g. `home.html`). */
  entry: string;
  /**
   * Resolves true once the wallet's already-unlocked UI is up. Only wallets that can reopen unlocked
   * (Phantom, Slush) declare it: without a positive signal for that state, a warm launch is
   * indistinguishable from an extension page that rendered nothing at all, and the run continues
   * against a dead wallet until some later approval fails for no visible reason.
   */
  isUnlocked?: (page: Page) => Promise<boolean>;
  /** Submit the filled password. Defaults to pressing Enter in the field. */
  submit?: (page: Page, field: Locator) => Promise<void>;
  wallet: string;
};

type UnlockScreen = {
  reachUnlockScreen: (context: BrowserContext, extensionId: string) => Promise<Page>;
  unlock: (page: Page, password: string) => Promise<void>;
};

/**
 * The shared unlock flow: open the wallet's own page, wait for it to settle into a state we can
 * name, and type the password. Every wallet differs only in its entry page, how it submits, and
 * whether it can come back already unlocked.
 */
export const createUnlockScreen = ({
  entry,
  isUnlocked,
  submit,
  wallet,
}: UnlockScreenOptions): UnlockScreen => {
  const settled = async (page: Page): Promise<"locked" | "unlocked" | undefined> => {
    const locked = await page
      .locator(PASSWORD_FIELD)
      .isVisible()
      .catch(() => false);
    if (locked) {
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

    const field = page.locator(PASSWORD_FIELD);
    await field.fill(password);
    await (submit === undefined ? field.press("Enter") : submit(page, field));
    const cleared = await field
      .waitFor({ state: "hidden", timeout: PASSWORD_CLEARED_TIMEOUT_MS })
      .then(() => true)
      .catch(() => false);
    if (!cleared) {
      throw new Error(
        `[walletwright] ${wallet} unlock failed (password screen still visible after ${formatTimeout(
          PASSWORD_CLEARED_TIMEOUT_MS,
        )})`,
      );
    }
  };

  return { reachUnlockScreen, unlock };
};
