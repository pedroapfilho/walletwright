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
    const popup = await findNotificationPopup(context, extensionId, match);
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
   * than something to swallow.
   */
  const action =
    (fn: ((ctx: WalletActionContext) => Promise<void>) | undefined, name: string) =>
    async (): Promise<void> => {
      if (!fn) {
        throw unsupported(name);
      }
      await fn(ctx);
    };

  return {
    approve,
    confirmSignature: () => approve({ optional: false }),
    // Connect may auto-approve on some wallets, so a missing popup is not an error here.
    connectToDapp: () => approve({ optional: true }),
    extensionId,
    home,
    reject,
    rejectConnection: () => reject({ optional: false }),
    rejectSignature: () => reject({ optional: false }),
    settings: {
      lock: action(definition.actions?.settings?.lock, "settings.lock"),
      unlock: action(definition.actions?.settings?.unlock, "settings.unlock"),
    },
  };
};
