import type { BrowserContext, Page } from "@playwright/test";

import type { Wallet, WalletActionContext, WalletDefinition } from "../types";

import { DEFAULT_NOTIFICATION_MATCH, findNotificationPopup, placeApprovalWindow } from "./utils";
import { formatTimeout, waitUntil } from "./wait";

const POPUP_CLOSE_TIMEOUT_MS = 15_000;
/** Optional approvals keep a short wait: "no popup" is a normal outcome, and the wait is latency. */
const OPTIONAL_POPUP_TIMEOUT_MS = 10_000;
/** The MV3 service worker spawns a popup slowly once the wallet's own UI has been driven. */
const REQUIRED_POPUP_TIMEOUT_MS = 30_000;
type ResolveOptions = { optional?: boolean };

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
};

/** Build the runtime controller that drives an unlocked wallet against the dapp under test. */
export const createWallet = ({
  context,
  definition,
  extensionId,
  home,
  password,
}: CreateWalletOptions): Wallet => {
  const match = definition.notificationMatch ?? DEFAULT_NOTIFICATION_MATCH;
  const ctx: WalletActionContext = { context, extensionId, home, password };

  /**
   * Make the dapp the active tab. While an extension page holds that spot, MetaMask renders a new
   * approval inline in it rather than opening a notification window, and the window that does open
   * shows the wallet home instead of the request. The wallet's own page can end up fronted both
   * after an action and after a previous approval settles.
   */
  const frontDapp = async (): Promise<void> => {
    const dapp = context.pages().find((page) => /^https?:/v.test(page.url()) && !page.isClosed());
    await dapp?.bringToFront().catch(() => {});
  };

  /**
   * Wait for the approval window the wallet opens for a pending request, and put it somewhere it can
   * be clicked. Placement is part of acquiring a popup rather than a separate step, so the retry path
   * below cannot end up driving an unplaced window: a window that opens partly off a small or virtual
   * display renders fine but refuses clicks, which reads as a confirm-button timeout.
   */
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

    /**
     * The postcondition is the negation of what was acquired: the request we drove is gone. Scanning
     * the whole context for any URL-matching page instead reported failure whenever a wallet chained
     * a second popup (MetaMask opening a SIWE request right after connect) or left a notification
     * window sitting on its home screen, neither of which means the approval failed. Enforced for
     * optional approvals too: `optional` means "a popup may never appear", not "a popup we drove may
     * hang", and skipping the check there let `connectToDapp()` report success on a stuck popup.
     */
    const closed = await waitUntil(() => driven.isClosed() || undefined, {
      timeoutMs: POPUP_CLOSE_TIMEOUT_MS,
    });
    if (closed === undefined) {
      throw new Error(
        `[walletwright] approval popup did not close after ${formatTimeout(POPUP_CLOSE_TIMEOUT_MS)} (the approval may not have registered)`,
      );
    }
  };

  const unsupported = (name: string): Error =>
    new Error(`[walletwright] ${definition.extensionName} does not support ${name}()`);

  const approve = (options: ResolveOptions = {}) =>
    resolvePopup((popup) => definition.approve(popup, password), options);

  const reject = (options: ResolveOptions = {}) =>
    resolvePopup((popup) => definition.reject(popup), options);

  /**
   * Bind an optional capability, or fail loudly naming the wallet and action. A wallet declares only
   * what has been driven against the real extension, so an undeclared action is a real gap rather
   * than something to swallow. Extra args (e.g. a network config) forward after the context.
   *
   * After the action, focus returns to the dapp (see `frontDapp`), since actions drive the wallet's
   * own page via `bringToFront`.
   */
  const action =
    <A extends ReadonlyArray<unknown>>(
      fn: ((ctx: WalletActionContext, ...args: A) => Promise<void>) | undefined,
      name: string,
    ) =>
    async (...args: A): Promise<void> => {
      if (!fn) {
        throw unsupported(name);
      }
      if (home.isClosed()) {
        throw new Error(`[walletwright] wallet home page is closed; cannot run ${name}()`);
      }
      await home.bringToFront().catch(() => {});
      await fn(ctx, ...args);
      await frontDapp();
    };

  return {
    accounts: {
      add: action(definition.actions?.accounts?.add, "accounts.add"),
      importPrivateKey: action(
        definition.actions?.accounts?.importPrivateKey,
        "accounts.importPrivateKey",
      ),
      rename: action(definition.actions?.accounts?.rename, "accounts.rename"),
      switch: action(definition.actions?.accounts?.switch, "accounts.switch"),
    },
    approve,
    confirmSignature: () => approve(),
    confirmTransaction: () => approve(),
    connectToDapp: () => approve({ optional: true }),
    extensionId,
    home,
    network: {
      add: action(definition.actions?.network?.add, "network.add"),
      switch: action(definition.actions?.network?.switch, "network.switch"),
    },
    reject,
    rejectConnection: () => reject(),
    rejectSignature: () => reject(),
    rejectTransaction: () => reject(),
    settings: {
      lock: action(definition.actions?.settings?.lock, "settings.lock"),
      unlock: action(definition.actions?.settings?.unlock, "settings.unlock"),
    },
  };
};
