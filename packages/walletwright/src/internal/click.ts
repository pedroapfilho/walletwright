import { errors } from "@playwright/test";
import type { Locator } from "@playwright/test";

import { formatTimeout, sleep, waitUntil } from "./wait";

/**
 * Playwright's default action timeout outside the test runner, which the onboarding clicks already
 * ran on. Wallet screens take seconds to render on a loaded runner, so a shorter default fails slow
 * machines rather than broken flows.
 */
const REQUIRED_TIMEOUT_MS = 30_000;
/**
 * An optional control is an interstitial some wallet versions or runs show and others skip, so a run
 * that skips it pays this whole budget. It follows a step the flow already waited on, which is why a
 * third of the required budget is enough.
 */
const OPTIONAL_TIMEOUT_MS = 10_000;

type ClickOptions = {
  /** Skip Playwright's actionability checks, for controls that are not native buttons (Slush). */
  force?: boolean;
  /** Pause between the control showing and the click, for a UI that wires handlers after render. */
  settleMs?: number;
  /** How long the control gets to show, and then to accept the click. */
  timeoutMs?: number;
};

type Clicks = {
  /** Wait for a control the flow cannot continue without, then click it. Throws if it never shows. */
  click: (control: Locator, options?: ClickOptions) => Promise<void>;
  /**
   * Click a control the flow can do without, if it shows within the budget. Resolves whether it
   * clicked. A control that shows and then refuses the click still throws.
   */
  clickIfShown: (control: Locator, options?: ClickOptions) => Promise<boolean>;
};

/**
 * `isVisible()` reads the current state and returns at once (its `timeout` does not wait), so a
 * late-mounting control reads absent. Only a timeout counts as absence: a strict-mode violation or
 * a closed page is a real failure and surfaces as one.
 */
const shows = async (control: Locator, timeoutMs: number): Promise<boolean> => {
  try {
    await control.waitFor({ state: "visible", timeout: timeoutMs });
    return true;
  } catch (error) {
    if (error instanceof errors.TimeoutError) {
      return false;
    }
    throw error;
  }
};

const PLACEMENT_INTERVAL_MS = 150;

/**
 * Wait for the control to sit inside the viewport and stop moving. A forced click skips the
 * stability check, so on a sheet that slides in it lands while the control is still off-screen, and
 * a scroll into view can dismiss the sheet instead.
 */
const settlesInView = async (control: Locator, timeoutMs: number): Promise<void> => {
  const viewport = control.page().viewportSize();
  let previous = "";
  await waitUntil(
    async () => {
      const box = await control.boundingBox().catch(() => null);
      const inView =
        box !== null &&
        box.y >= 0 &&
        box.x >= 0 &&
        (viewport === null ||
          (box.y + box.height <= viewport.height && box.x + box.width <= viewport.width));
      const current = inView ? JSON.stringify(box) : "";
      const settled = current !== "" && current === previous;
      previous = current;
      return settled;
    },
    { intervalMs: PLACEMENT_INTERVAL_MS, timeoutMs },
  );
};

/** The one way a wallet file clicks its own UI, with errors that name the wallet and the control. */
const clicksFor = (wallet: string): Clicks => {
  const clickIfShown: Clicks["clickIfShown"] = async (
    control,
    { force = false, settleMs = 0, timeoutMs = OPTIONAL_TIMEOUT_MS } = {},
  ) => {
    if (!(await shows(control, timeoutMs))) {
      return false;
    }
    if (force) {
      await settlesInView(control, timeoutMs);
    }
    await sleep(settleMs);
    try {
      await control.click({ force, timeout: timeoutMs });
    } catch (error) {
      throw new Error(`[walletwright] ${wallet} showed ${String(control)} but it took no click`, {
        cause: error,
      });
    }
    return true;
  };

  const click: Clicks["click"] = async (
    control,
    { timeoutMs = REQUIRED_TIMEOUT_MS, ...options } = {},
  ) => {
    if (!(await clickIfShown(control, { ...options, timeoutMs }))) {
      throw new Error(
        `[walletwright] ${wallet} never showed ${String(control)} (gave up after ${formatTimeout(timeoutMs)})`,
      );
    }
  };

  return { click, clickIfShown };
};

export { clicksFor };
