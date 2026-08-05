import type { BrowserContext, Page } from "@playwright/test";

import type { Wallet, WalletActionContext, WalletDefinition } from "../types";

import {
  DEFAULT_NOTIFICATION_MATCH,
  findNotificationPopup,
  hasNotificationPopup,
  openNotificationPage,
} from "./utils";
import { formatTimeout, waitUntil } from "./wait";

const POPUP_CLOSE_TIMEOUT_MS = 15_000;
/**
 * How long to look for a wallet-spawned window before the engine opens the approval itself. Short
 * because it is a probe, not the main wait: headless, Phantom does surface its approval window as a
 * page while MetaMask never does, and a wallet of the first kind must be driven in the window it
 * opened, or its request sits in a window nobody touched.
 */
const SPAWN_PROBE_TIMEOUT_MS = 5000;
/**
 * Floor on how long an engine-opened approval page may take to route to the pending request.
 * Measured at up to 11s against MetaMask on a cold MV3 worker, so the optional budget (10s) is not
 * enough even when an approval is definitely pending. An idle entry never routes at all, so the
 * wait is only ever spent in full when there is genuinely nothing to approve.
 */
const APPROVAL_PAGE_MIN_TIMEOUT_MS = 30_000;

type ResolveOptions = { optional?: boolean };

/**
 * A pending approval, and whether the engine opened it. A window the wallet spawned closes itself
 * once the approval registers, and closing it any earlier can abort the request; a page the engine
 * opened closes only if the engine closes it, and otherwise comes back as a stale approval.
 */
type Approval = { owned: boolean; page: Page };

type CreateWalletOptions = {
  /**
   * Approval entry for the engine to open when it finds no window to drive, set headless, where a
   * wallet's approval window may never surface as a page. Undefined means popups only.
   */
  approvalPage?: string;
  context: BrowserContext;
  definition: WalletDefinition;
  extensionId: string;
  /** The wallet's own page, left open after unlock, that the actions drive. */
  home: Page;
  password: string;
};

/** Build the runtime controller that drives an unlocked wallet against the dapp under test. */
export const createWallet = ({
  approvalPage,
  context,
  definition,
  extensionId,
  home,
  password,
}: CreateWalletOptions): Wallet => {
  const match = definition.notificationMatch ?? DEFAULT_NOTIFICATION_MATCH;
  const ctx: WalletActionContext = { context, extensionId, home, password };

  /** Reach the pending approval: the window the wallet spawned, or the page the engine opens. */
  const findApproval = async (timeoutMs: number): Promise<Approval | undefined> => {
    const spawned = await findNotificationPopup(
      context,
      extensionId,
      match,
      approvalPage === undefined ? timeoutMs : SPAWN_PROBE_TIMEOUT_MS,
    );
    if (spawned) {
      return { owned: false, page: spawned };
    }
    if (approvalPage === undefined) {
      return undefined;
    }
    const opened = await openNotificationPage({
      context,
      extensionId,
      match,
      notificationPage: approvalPage,
      timeoutMs: Math.max(timeoutMs, APPROVAL_PAGE_MIN_TIMEOUT_MS),
    });
    return opened ? { owned: true, page: opened } : undefined;
  };

  /** Drive the pending approval popup with `settle`, then wait for it to close. */
  const resolvePopup = async (
    settle: (popup: Page) => Promise<void>,
    { optional = false }: ResolveOptions,
  ): Promise<void> => {
    // Required popups get 30s: the MV3 service worker spawns them slowly after the wallet's own UI
    // has been driven. Optional ones keep the short wait, since "no popup" is a normal outcome
    // there (e.g. Phantom auto-approving a trusted site) and the extra wait would just be latency.
    const find = () => findApproval(optional ? 10_000 : 30_000);
    let approval = await find();
    if (!approval) {
      if (optional) {
        return; // e.g. Phantom auto-approves an already-trusted site (no popup)
      }
      throw new Error("[walletwright] approval popup did not appear");
    }
    try {
      await settle(approval.page);
    } catch (error) {
      // The finder can grab the previous popup in its final moments (the window closes right after
      // its own approval resolves). If ours died under us, one fresh find gets the real popup.
      if (!approval.page.isClosed()) {
        throw error;
      }
      const fresh = await find();
      if (!fresh) {
        throw error;
      }
      // Only the latest needs closing: a retry happens because the previous page had already gone.
      approval = fresh;
      await settle(fresh.page);
    } finally {
      if (approval.owned) {
        await approval.page.close().catch(() => {});
      }
    }

    // Wait for the popup to close so the next approval doesn't grab a stale page.
    const closed = await waitUntil(() => !hasNotificationPopup(context, extensionId, match), {
      timeoutMs: POPUP_CLOSE_TIMEOUT_MS,
    });
    if (!optional && closed === undefined) {
      throw new Error(
        `[walletwright] approval popup did not close after ${formatTimeout(POPUP_CLOSE_TIMEOUT_MS)} (the approval may not have registered)`,
      );
    }
  };

  const unsupported = (name: string): Error =>
    new Error(`[walletwright] ${definition.extensionName} does not support ${name}()`);

  const approve = (options: ResolveOptions = {}) =>
    resolvePopup((popup) => definition.approve(popup, password), options);

  const reject = async (options: ResolveOptions = {}): Promise<void> => {
    const { reject: rejectPopup } = definition;
    if (!rejectPopup) {
      throw unsupported("reject");
    }
    await resolvePopup((popup) => rejectPopup(popup), options);
  };

  /**
   * Bind an optional capability, or fail loudly naming the wallet and action. A wallet declares only
   * what has been driven against the real extension, so an undeclared action is a real gap rather
   * than something to swallow. Extra args (e.g. a network config) forward after the context.
   *
   * After the action, focus returns to the dapp: actions drive the wallet's own page via
   * `bringToFront`, and while an extension page stays the active tab, MetaMask renders new
   * approvals inline there instead of spawning the `notification.html` popup the engine drives.
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
      // Actions drive the wallet's own page; front it first so clicks land on a visible tab, then
      // hand focus back to the dapp below so new approvals open as popups instead of inline.
      await home.bringToFront().catch(() => {});
      await fn(ctx, ...args);
      const dapp = context.pages().find((page) => /^https?:/v.test(page.url()) && !page.isClosed());
      await dapp?.bringToFront().catch(() => {});
    };

  // A capability is declared once, on the *Api types in types.ts: WalletActions derives from those,
  // so a new method makes this object fail to compile until it is bound. Only the fn-to-slot pairing
  // below can still be wrong, and capability-wiring.test.ts guards that.
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
    // Connect may auto-approve on some wallets, so a missing popup is not an error here.
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
