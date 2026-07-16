import type { Ecosystem, WalletDefinition, WalletKind } from "../types.ts";

import { metamask } from "./metamask/index.ts";
import { phantom } from "./phantom.ts";
import { slush } from "./slush.ts";

export const wallets: Record<WalletKind, WalletDefinition> = {
  metamask,
  phantom,
  slush,
};

/** Wallet kinds that can drive the given ecosystem (e.g. `"evm"` → MetaMask, Phantom). */
export const walletKindsByEcosystem = (ecosystem: Ecosystem): Array<WalletKind> =>
  (Object.keys(wallets) as Array<WalletKind>).filter((kind) =>
    wallets[kind].ecosystems.includes(ecosystem),
  );
