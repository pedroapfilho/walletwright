import type { BrowserContext } from "@playwright/test";

import type { Wallet, WalletDefinition } from "../types.ts";

import { findNotificationPopup, hasNotificationPopup, sleep } from "./utils.ts";

/** Build the runtime controller that drives an unlocked wallet against the dapp under test. */
export const createWallet = (
  context: BrowserContext,
  definition: WalletDefinition,
  extensionId: string,
  password: string,
): Wallet => {
  const match = definition.notificationMatch ?? "notification.html";

  const approve = async ({ optional = false }: { optional?: boolean } = {}): Promise<void> => {
    const popup = await findNotificationPopup(context, extensionId, match);
    if (!popup) {
      if (optional) {
        return; // e.g. Phantom auto-approves an already-trusted site (no popup)
      }
      throw new Error("[walletwright] approval popup did not appear");
    }
    await definition.approve(popup, password);

    // Wait for the popup to close so the next approval doesn't grab a stale page.
    const deadline = Date.now() + 15_000;
    while (hasNotificationPopup(context, extensionId, match) && Date.now() < deadline) {
      await sleep(200);
    }
  };

  return {
    approve,
    extensionId,
    // Connect may auto-approve on some wallets, so a missing popup is not an error here.
    confirmSignature: () => approve({ optional: false }),
    connectToDapp: () => approve({ optional: true }),
  };
};
