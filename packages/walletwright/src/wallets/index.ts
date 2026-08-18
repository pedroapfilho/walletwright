import type { Ecosystem, WalletDefinition, WalletKind } from "../types";

import { metamask } from "./metamask";
import { phantom } from "./phantom";
import { rabby } from "./rabby";
import { slush } from "./slush";
import { solflare } from "./solflare";

export const wallets = {
  metamask,
  phantom,
  rabby,
  slush,
  solflare,
} satisfies Record<WalletKind, WalletDefinition>;

/** Narrow an arbitrary string (CLI flag, setup file field) to a supported wallet. */
export const isWalletKind = (value: string): value is WalletKind => Object.hasOwn(wallets, value);

const walletKinds = Object.keys(wallets).filter(isWalletKind);

/** Wallet kinds that can drive the given ecosystem (e.g. `"evm"` → MetaMask, Phantom). */
export const walletKindsByEcosystem = (ecosystem: Ecosystem): Array<WalletKind> =>
  walletKinds.filter((kind) => wallets[kind].ecosystems.includes(ecosystem));
