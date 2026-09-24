import type { BrowserContext, Page } from "@playwright/test";

import type { Wallet, WalletActionContext, WalletDefinition } from "../types";

import { DEFAULT_NOTIFICATION_MATCH, findNotificationPopup, placeApprovalWindow } from "./popup";
import { formatTimeout, waitUntil } from "./wait";

const POPUP_CLOSE_TIMEOUT_MS = 15_000;
/** Optional approvals keep a short wait: "no popup" is a normal outcome, and the wait is latency. */
const OPTIONAL_POPUP_TIMEOUT_MS = 10_000;
/** A popup that has to appear gets the full wait: the MV3 service worker can be slow to spawn it. */
const REQUIRED_POPUP_TIMEOUT_MS = 30_000;
type ResolveOptions = { optional?: boolean };

/**
 * Runs one named wallet call. The Playwright fixtures report each call as a boxed `test.step`;
 * `launchWallet` has no test to report into, so it runs the call directly.
 */
export type StepRunner = (title: string, body: () => Promise<void>) => Promise<void>;

export const runDirectly: StepRunner = (_title, body) => body();

/**
 * Drive `popup` with `settle` and return the page that actually took the approval. A popup that
 * closes mid-settle is the wallet respawning the request, so re-acquire once and drive the new one.
 */
const settleApproval = async (
  settle: (popup: Page) => Promise<void>,
  popup: Page,
  acquire: () => Promise<Page | undefined>,
): Promise<Page> => {
  try {
    await settle(popup);
    return popup;
  } catch (error) {
    if (!popup.isClosed()) {
      throw error;
    }
    const fresh = await acquire();
    if (!fresh) {
      throw error;
    }
    await settle(fresh);
    return fresh;
  }
};

type CreateWalletOptions = {
  context: BrowserContext;
  definition: WalletDefinition;
  extensionId: string;
  /** The wallet's own page, left open after unlock, that the actions drive. */
  home: Page;
  password: string;
  step: StepRunner;
  /** Unlock `home` again through the wallet's unlock screen. */
  unlock: () => Promise<void>;
};

/** Build the runtime controller that drives an unlocked wallet against the dapp under test. */
export const createWallet = ({
  context,
  definition,
  extensionId,
  home,
  password,
  step,
  unlock,
}: CreateWalletOptions): Wallet => {
  const match = definition.notificationMatch ?? DEFAULT_NOTIFICATION_MATCH;
  const ctx: WalletActionContext = { context, extensionId, home, password, unlock };

  /** MetaMask opens requests inline while its extension page owns focus. */
  const frontDapp = async (): Promise<void> => {
    const dapp = context.pages().find((page) => /^https?:/v.test(page.url()) && !page.isClosed());
    await dapp?.bringToFront().catch(() => {});
  };

  /** Find and place the approval window before its controls are driven. */
  const acquireApproval = async (optional: boolean): Promise<Page | undefined> => {
    const popup = await findNotificationPopup({
      approvalControls: definition.approvalControls,
      context,
      extensionId,
      match,
      timeoutMs: optional ? OPTIONAL_POPUP_TIMEOUT_MS : REQUIRED_POPUP_TIMEOUT_MS,
    });
    if (popup) {
      await placeApprovalWindow(popup);
    }
    return popup;
  };

  /** Drive the pending approval popup with `settle`, then wait for that popup to close. */
  const resolvePopup = async (
    settle: (popup: Page) => Promise<void>,
    { optional = false }: ResolveOptions,
  ): Promise<void> => {
    await frontDapp();
    const acquire = () => acquireApproval(optional);
    const popup = await acquire();
    if (!popup) {
      if (optional) {
        return; // e.g. Phantom auto-approves an already-trusted site (no popup)
      }
      const open = context.pages().map((page) => page.url());
      throw new Error(
        `[walletwright] approval popup did not appear. Open pages: ${open.join(" | ") || "none"}`,
      );
    }

    const driven = await settleApproval(settle, popup, acquire);

    /** Wait for the exact popup we drove; chained popups may reuse the same URL. */
    const closed = await waitUntil(() => driven.isClosed() || undefined, {
      timeoutMs: POPUP_CLOSE_TIMEOUT_MS,
    });
    if (closed === undefined) {
      throw new Error(
        `[walletwright] approval popup did not close after ${formatTimeout(POPUP_CLOSE_TIMEOUT_MS)} (the approval may not have registered)`,
      );
    }
  };

  /**
   * Every public call goes through here, so each one reaches `step` under its own name. It awaits
   * `step` itself because Playwright reports a boxed step at the caller of the function awaiting it,
   * which makes that the spec line; another async layer in between would move it into this package.
   */
  const named =
    <Args extends ReadonlyArray<unknown>>(name: string, fn: (...args: Args) => Promise<void>) =>
    async (...args: Args): Promise<void> => {
      await step(`wallet.${name}`, () => fn(...args));
    };

  const approve = (options: ResolveOptions = {}) =>
    resolvePopup((popup) => definition.approve(popup, password), options);

  const reject = (options: ResolveOptions = {}) =>
    resolvePopup((popup) => definition.reject(popup), options);

  /** Bind a verified wallet action and restore focus to the dapp when it finishes. */
  const action = <Args extends ReadonlyArray<unknown>>(
    name: string,
    fn: ((ctx: WalletActionContext, ...args: Args) => Promise<void>) | undefined,
  ) =>
    named(name, async (...args: Args): Promise<void> => {
      if (!fn) {
        throw new Error(`[walletwright] ${definition.extensionName} does not support ${name}()`);
      }
      if (home.isClosed()) {
        throw new Error(`[walletwright] wallet home page is closed; cannot run ${name}()`);
      }
      await home.bringToFront().catch(() => {});
      await fn(ctx, ...args);
      await frontDapp();
    });

  const { accounts, network, settings } = definition.actions ?? {};

  return {
    accounts: {
      add: action("accounts.add", accounts?.add),
      importPrivateKey: action("accounts.importPrivateKey", accounts?.importPrivateKey),
      rename: action("accounts.rename", accounts?.rename),
      switch: action("accounts.switch", accounts?.switch),
    },
    approve: named("approve", approve),
    confirmSignature: named("confirmSignature", () => approve()),
    confirmTransaction: named("confirmTransaction", () => approve()),
    connectToDapp: named("connectToDapp", approve),
    extensionId,
    home,
    network: {
      add: action("network.add", network?.add),
    },
    reject: named("reject", reject),
    rejectConnection: named("rejectConnection", () => reject()),
    rejectSignature: named("rejectSignature", () => reject()),
    rejectTransaction: named("rejectTransaction", () => reject()),
    settings: {
      lock: action("settings.lock", settings?.lock),
      unlock: action("settings.unlock", settings?.unlock),
    },
  };
};
