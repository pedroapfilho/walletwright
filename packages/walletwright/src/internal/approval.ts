import type { BrowserContext, Locator, Page } from "@playwright/test";

import type { ApprovalScreen, WalletDefinition } from "../types";

import { clicksFor } from "./click";
import { asksForPassword } from "./unlock-screen";
import { formatTimeout, sleep, waitUntil } from "./wait";

/** Every approval runs on these, whichever wallet it is. */
const BUDGETS = {
  /** A required window: the MV3 service worker can take 10s+ to spawn it. */
  appear: 30_000,
  /** An optional window: "no window" is a normal outcome, and the wait is latency. */
  appearOptional: 10_000,
  /**
   * From the window showing a request to it closing: screens, clicks, re-authentication. Generous
   * because a loaded CI runner renders MetaMask's footer slowly.
   */
  answer: 60_000,
  /** One click, once its control shows enabled; a covered control is retried on the next pass. */
  click: 10_000,
  /** A read of one control that may unmount under it. */
  read: 500,
} as const;

const PASS_INTERVAL_MS = 250;

const DEFAULT_URL_MATCH = "notification.html";

/** MetaMask's own popup dimensions, which its layout is built for. */
const APPROVAL_WINDOW = { height: 592, width: 360 };

/** Far enough from the edge that a popup this size lands fully on any usable display. */
const APPROVAL_WINDOW_OFFSET = 50;

export type AnswerOptions = { optional?: boolean };

export type Approvals = {
  approve: (options?: AnswerOptions) => Promise<void>;
  reject: (options?: AnswerOptions) => Promise<void>;
};

type Intent = "cancel" | "confirm";

/** Whether any match shows: a union's first match in DOM order can be a hidden variant. */
const isShowing = async (control: Locator): Promise<boolean> => {
  try {
    return await control.filter({ visible: true }).first().isVisible();
  } catch {
    return false; // the page can go while we ask
  }
};

/** MetaMask opens requests inline while its extension page owns focus, so the dapp goes in front. */
export const frontDapp = async (context: BrowserContext): Promise<void> => {
  const dapp = context.pages().find((page) => /^https?:/v.test(page.url()) && !page.isClosed());
  await dapp?.bringToFront().catch(() => {});
};

/** Move the window on-screen; headless and unsupported CDP targets are ignored. */
const placeApprovalWindow = async (page: Page): Promise<void> => {
  await page.setViewportSize(APPROVAL_WINDOW).catch(() => {});

  try {
    const session = await page.context().newCDPSession(page);
    const { targetInfo } = await session.send("Target.getTargetInfo");

    const { windowId } = await session.send("Browser.getWindowForTarget", {
      targetId: targetInfo.targetId,
    });

    await session.send("Browser.setWindowBounds", {
      bounds: { left: APPROVAL_WINDOW_OFFSET, top: APPROVAL_WINDOW_OFFSET },
      windowId,
    });
    await session.detach();
  } catch {
    // no window to place (headless), or the page refused a CDP session
  }
};

/**
 * The first control that shows enabled and has not been clicked in this window yet, by label: a
 * label clicked again re-issues the request in Rabby and the dapp ends up with nothing.
 */
const nextControl = async (
  controls: Locator,
  clicked: ReadonlySet<string>,
): Promise<{ control: Locator; label: string } | undefined> => {
  for (const control of await controls.all()) {
    const label = await control
      .textContent({ timeout: BUDGETS.read })
      .then((text) => text?.trim())
      .catch(() => undefined);

    if (label === undefined || clicked.has(label) || !(await isShowing(control))) {
      continue;
    }

    if (await control.isEnabled({ timeout: BUDGETS.read }).catch(() => false)) {
      return { control, label };
    }
  }

  return undefined;
};

/** What went wrong with a window that never closed, for the error that says so. */
const unanswered = (
  intent: Intent,
  clicked: ReadonlySet<string>,
  refusal: Error | undefined,
): string => {
  if (clicked.size > 0) {
    return `'s approval window stayed open after ${[...clicked].map((label) => `"${label}"`).join(", ")}`;
  }

  if (refusal !== undefined) {
    return ` refused every click on its ${intent} control`;
  }

  return ` never offered an enabled ${intent} control`;
};

type CreateApprovalsOptions = {
  context: BrowserContext;
  definition: Pick<WalletDefinition, "approval" | "extensionName">;
  extensionId: string;
  /** Enter the password into a window that asks for it again, through the shared unlock flow. */
  reauthenticate: (popup: Page) => Promise<void>;
};

/**
 * Drive the wallet's approval window from the request to its answer: find the window the wallet
 * opened, place it, pass the screens it puts up, and click until the window closes. The engine
 * never opens an approval URL itself: a page the wallet did not open for a request shows its home.
 */
export const createApprovals = ({
  context,
  definition: { approval, extensionName: wallet },
  extensionId,
  reauthenticate,
}: CreateApprovalsOptions): Approvals => {
  const {
    cancel,
    click: clickStrategy = { kind: "locator" },
    confirm,
    screens = [],
    urlMatch = DEFAULT_URL_MATCH,
  } = approval;

  const { click } = clicksFor(wallet);
  const settleMs = clickStrategy.kind === "locator" ? (clickStrategy.settleMs ?? 0) : 0;

  const press = async (control: Locator): Promise<void> => {
    if (clickStrategy.kind === "inPage") {
      await control.evaluate(
        (element: HTMLElement) => {
          element.click();
        },
        undefined,
        { timeout: BUDGETS.click },
      );

      return;
    }

    await click(control, { settleMs, timeoutMs: BUDGETS.click });
  };

  /** A request control, or a password prompt in front of one, is what makes a window answerable. */
  const awaitsAnswer = async (popup: Page): Promise<boolean> =>
    (await isShowing(confirm(popup).or(cancel(popup)))) || asksForPassword(popup);

  /**
   * Approval windows open as `about:blank` and route to the request later, so this polls the open
   * pages rather than waiting for a `page` event, and only takes a window once it is answerable.
   */
  const acquire = async (timeoutMs: number): Promise<Page | undefined> => {
    const popup = await waitUntil(
      async () => {
        const candidates = context
          .pages()
          .filter(
            (page) =>
              !page.isClosed() &&
              page.url().startsWith(`chrome-extension://${extensionId}`) &&
              page.url().includes(urlMatch),
          );

        for (const candidate of candidates) {
          await candidate.waitForLoadState("domcontentloaded").catch(() => {});

          if (await awaitsAnswer(candidate)) {
            return candidate;
          }
        }

        return undefined;
      },
      { timeoutMs },
    );

    if (popup !== undefined) {
      await placeApprovalWindow(popup);
    }

    return popup;
  };

  /** Resolves the click's failure, if it failed with the window still open. */
  const pressOrRefusal = async (popup: Page, control: Locator): Promise<Error | undefined> => {
    try {
      await press(control);

      return undefined;
    } catch (error) {
      if (popup.isClosed()) {
        return undefined;
      }

      return error instanceof Error ? error : new Error(String(error));
    }
  };

  /**
   * Answer one window until it closes. A window that closes before any click was tried is the wallet
   * replacing it, and the caller looks for the new one. A click that closes its window counts even
   * when Playwright reports the closing as a failed click.
   */
  const answerWindow = async (
    popup: Page,
    intent: Intent,
    deadline: number,
  ): Promise<"answered" | "replaced"> => {
    const controls = intent === "confirm" ? confirm : cancel;
    const clicked = new Set<string>();
    const pending = new Set<ApprovalScreen>(screens);
    let tried = false;
    let refusal: Error | undefined;

    /** Re-authenticate or pass a screen if the window shows one, else find the control to click. */
    const nextClick = async (): Promise<{ control: Locator; label: string } | undefined> => {
      if (await asksForPassword(popup)) {
        await sleep(settleMs);
        await reauthenticate(popup);

        return undefined;
      }

      for (const screen of pending) {
        if (await screen.shows(popup)) {
          pending.delete(screen);
          await screen.pass(popup);

          return undefined;
        }
      }

      return nextControl(controls(popup), clicked);
    };

    while (Date.now() < deadline && !popup.isClosed()) {
      try {
        const next = await nextClick();

        if (next !== undefined) {
          tried = true;
          clicked.add(next.label);
          const error = await pressOrRefusal(popup, next.control);

          if (error !== undefined) {
            clicked.delete(next.label);
            refusal = error;
          }
        }
      } catch (error) {
        if (!popup.isClosed()) {
          throw error;
        }
      }

      await sleep(PASS_INTERVAL_MS);
    }

    if (popup.isClosed()) {
      return tried ? "answered" : "replaced";
    }

    throw new Error(
      `[walletwright] ${wallet}${unanswered(intent, clicked, refusal)} (gave up after ${formatTimeout(BUDGETS.answer)})`,
      { cause: refusal },
    );
  };

  const answer = async (intent: Intent, { optional = false }: AnswerOptions = {}) => {
    await frontDapp(context);
    const appear = optional ? BUDGETS.appearOptional : BUDGETS.appear;
    let popup = await acquire(appear);

    if (popup === undefined) {
      if (optional) {
        return; // e.g. Phantom auto-approves an already-trusted site (no window)
      }

      const open = context.pages().map((page) => page.url());
      throw new Error(
        `[walletwright] ${wallet}'s approval window did not appear (gave up after ${formatTimeout(appear)}). Open pages: ${open.join(" | ") || "none"}`,
      );
    }

    const deadline = Date.now() + BUDGETS.answer;

    while ((await answerWindow(popup, intent, deadline)) === "replaced") {
      popup = await acquire(Math.max(0, deadline - Date.now()));

      if (popup === undefined) {
        throw new Error(
          `[walletwright] ${wallet}'s approval window closed before it was answered, and no window replaced it`,
        );
      }
    }
  };

  return {
    approve: (options) => answer("confirm", options),
    reject: (options) => answer("cancel", options),
  };
};
