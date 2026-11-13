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

/** A read of one control that may unmount under it. */
const READ_TIMEOUT_MS = 500;

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
  /** Wait for a control the flow dismissed to go, without clicking it. Throws if it stays. */
  waitGone: (control: Locator, options?: Pick<ClickOptions, "timeoutMs">) => Promise<void>;
  /** Wait for a control the flow needs to show, without clicking it. Throws if it never does. */
  waitShown: (control: Locator, options?: Pick<ClickOptions, "timeoutMs">) => Promise<void>;
};

/** The first match that shows: a locator's first match in DOM order can be a hidden variant. */
const showing = (control: Locator): Locator => control.filter({ visible: true }).first();

/** Whether any match shows right now, for a poll that must not wait: the page can go while we ask. */
const isShowing = async (control: Locator): Promise<boolean> => {
  try {
    return await showing(control).isVisible();
  } catch {
    return false;
  }
};

/** The control's trimmed text, for telling controls apart; a control that went has none. */
const labelOf = async (control: Locator): Promise<string | undefined> => {
  try {
    const text = await control.textContent({ timeout: READ_TIMEOUT_MS });

    return text?.trim();
  } catch {
    return undefined;
  }
};

/**
 * Whether the first showing match is enabled, read within `READ_TIMEOUT_MS`, so it reads the
 * element `isShowing` saw; a control that went reads disabled.
 */
const isEnabled = async (control: Locator): Promise<boolean> => {
  try {
    return await showing(control).isEnabled({ timeout: READ_TIMEOUT_MS });
  } catch {
    return false;
  }
};

/**
 * `isVisible()` reads the current state and returns at once (its `timeout` does not wait), so a
 * late-mounting control reads absent. Only a timeout counts as absence: a strict-mode violation or
 * a closed page is a real failure and surfaces as one.
 */
const showsWithin = async (control: Locator, timeoutMs: number): Promise<boolean> => {
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
 * A slow renderer holds a sliding sheet on one frame for over a second, so an unchanged box alone
 * reads as settled mid-slide, and Slush drops a press that lands there.
 */
const isAnimating = async (control: Locator): Promise<boolean> => {
  try {
    return await control.evaluate((element) =>
      document.getAnimations().some((animation) => {
        const target = animation.effect instanceof KeyframeEffect ? animation.effect.target : null;

        return animation.playState === "running" && target?.contains(element) === true;
      }),
    );
  } catch {
    return true;
  }
};

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
      const settled = current !== "" && current === previous && !(await isAnimating(control));
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
    if (!(await showsWithin(control, timeoutMs))) {
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

  const neverShowed = (control: Locator, timeoutMs: number): Error =>
    new Error(
      `[walletwright] ${wallet} never showed ${String(control)} (gave up after ${formatTimeout(timeoutMs)})`,
    );

  const click: Clicks["click"] = async (
    control,
    { timeoutMs = REQUIRED_TIMEOUT_MS, ...options } = {},
  ) => {
    if (!(await clickIfShown(control, { ...options, timeoutMs }))) {
      throw neverShowed(control, timeoutMs);
    }
  };

  const waitShown: Clicks["waitShown"] = async (
    control,
    { timeoutMs = REQUIRED_TIMEOUT_MS } = {},
  ) => {
    if (!(await showsWithin(control, timeoutMs))) {
      throw neverShowed(control, timeoutMs);
    }
  };

  const waitGone: Clicks["waitGone"] = async (
    control,
    { timeoutMs = REQUIRED_TIMEOUT_MS } = {},
  ) => {
    try {
      await control.waitFor({ state: "hidden", timeout: timeoutMs });
    } catch (error) {
      if (!(error instanceof errors.TimeoutError)) {
        throw error;
      }

      throw new Error(
        `[walletwright] ${wallet} still showed ${String(control)} (gave up after ${formatTimeout(timeoutMs)})`,
        { cause: error },
      );
    }
  };

  return { click, clickIfShown, waitGone, waitShown };
};

export { clicksFor, isEnabled, isShowing, labelOf, showing, showsWithin };
