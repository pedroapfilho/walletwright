import type { Ecosystem, WalletDefinition, WalletKind } from "../types.ts";

import { metamask } from "./metamask.ts";
import { phantom } from "./phantom.ts";
import { rabby } from "./rabby.ts";
import { slush } from "./slush.ts";
import { solflare } from "./solflare.ts";

export const wallets: Record<WalletKind, WalletDefinition> = {
  metamask,
  phantom,
  rabby,
  slush,
  solflare,
};

/** Wallet kinds that can drive the given ecosystem (e.g. `"evm"` → MetaMask, Phantom). */
export const walletKindsByEcosystem = (ecosystem: Ecosystem): Array<WalletKind> =>
  (Object.keys(wallets) as Array<WalletKind>).filter((kind) =>
    wallets[kind].ecosystems.includes(ecosystem),
  );
