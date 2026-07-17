import type { BrowserContext, Page } from "@playwright/test";

import type { Wallet, WalletActionContext, WalletDefinition } from "../types.ts";

import { findNotificationPopup, hasNotificationPopup, sleep } from "./utils.ts";

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
  const match = definition.notificationMatch ?? "notification.html";
  const ctx: WalletActionContext = { context, extensionId, home, password };

  /** Drive the pending approval popup with `settle`, then wait for it to close. */
  const resolvePopup = async (
    settle: (popup: Page) => Promise<void>,
    { optional = false }: ResolveOptions,
  ): Promise<void> => {
    // Required popups get 30s: the MV3 service worker spawns them slowly after the wallet's own UI
    // has been driven. Optional ones keep the short wait, since "no popup" is a normal outcome
    // there (e.g. Phantom auto-approving a trusted site) and the extra wait would just be latency.
    const popup = await findNotificationPopup(
      context,
      extensionId,
      match,
      optional ? 10_000 : 30_000,
    );
    if (!popup) {
      if (optional) {
        return; // e.g. Phantom auto-approves an already-trusted site (no popup)
      }
      throw new Error("[walletwright] approval popup did not appear");
    }
    await settle(popup);

    // Wait for the popup to close so the next approval doesn't grab a stale page.
    const deadline = Date.now() + 15_000;
    while (hasNotificationPopup(context, extensionId, match) && Date.now() < deadline) {
      await sleep(200);
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
      await fn(ctx, ...args);
      const dapp = context.pages().find((page) => /^https?:/v.test(page.url()) && !page.isClosed());
      await dapp?.bringToFront().catch(() => {});
    };

  return {
    approve,
    confirmSignature: () => approve({ optional: false }),
    // Connect may auto-approve on some wallets, so a missing popup is not an error here.
    connectToDapp: () => approve({ optional: true }),
    extensionId,
    home,
    network: {
      add: action(definition.actions?.network?.add, "network.add"),
      switch: action(definition.actions?.network?.switch, "network.switch"),
    },
    reject,
    rejectConnection: () => reject({ optional: false }),
    rejectSignature: () => reject({ optional: false }),
    settings: {
      lock: action(definition.actions?.settings?.lock, "settings.lock"),
      unlock: action(definition.actions?.settings?.unlock, "settings.unlock"),
    },
  };
};
