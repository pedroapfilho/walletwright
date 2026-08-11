import type { BrowserContext, Page } from "@playwright/test";

import type { Wallet, WalletActionContext, WalletDefinition } from "../types";

import {
  DEFAULT_NOTIFICATION_MATCH,
  findNotificationPopup,
  hasNotificationPopup,
  placeApprovalWindow,
} from "./utils";
import { formatTimeout, waitUntil } from "./wait";

const POPUP_CLOSE_TIMEOUT_MS = 15_000;
/** Optional approvals keep a short wait: "no popup" is a normal outcome, and the wait is latency. */
const OPTIONAL_POPUP_TIMEOUT_MS = 10_000;
/** The MV3 service worker spawns a popup slowly once the wallet's own UI has been driven. */
const REQUIRED_POPUP_TIMEOUT_MS = 30_000;
type ResolveOptions = { optional?: boolean };

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

  /** Wait for the approval window the wallet opens for a pending request. */
  const findApproval = (optional: boolean): Promise<Page | undefined> =>
    findNotificationPopup({
      approvalControls: definition.approvalControls,
      context,
      extensionId,
      match,
      timeoutMs: optional ? OPTIONAL_POPUP_TIMEOUT_MS : REQUIRED_POPUP_TIMEOUT_MS,
    });

  /** Drive the pending approval popup with `settle`, then wait for it to close. */
  const resolvePopup = async (
    settle: (popup: Page) => Promise<void>,
    { optional = false }: ResolveOptions,
  ): Promise<void> => {
    await frontDapp();
    const find = () => findApproval(optional);
    const popup = await find();
    if (!popup) {
      if (optional) {
        return; // e.g. Phantom auto-approves an already-trusted site (no popup)
      }
      const open = context.pages().map((page) => page.url());
      throw new Error(
        `[walletwright] approval popup did not appear. Open pages: ${open.join(" | ") || "none"}`,
      );
    }
    await placeApprovalWindow(popup); // it can open partly off a small or virtual display
    try {
      await settle(popup);
    } catch (error) {
      if (!popup.isClosed()) {
        throw error;
      }
      const fresh = await find();
      if (!fresh) {
        throw error;
      }
      await settle(fresh);
    }

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
