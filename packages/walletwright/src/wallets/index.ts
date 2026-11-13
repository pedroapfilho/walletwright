import type { WalletDefinition } from "../internal/definition";
import type { WalletInfo, WalletKind } from "../types";

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

export const walletKinds: ReadonlyArray<WalletKind> = Object.keys(wallets).filter(isWalletKind);

const describe = ({
  ecosystems,
  extensionName,
  headless,
  source,
}: WalletDefinition): WalletInfo => ({
  ecosystems,
  headless,
  name: extensionName,
  pinnable: source.kind === "release",
});

/** Every supported wallet as plain data, read off the definitions the engine drives. */
export const walletInfo: Readonly<Record<WalletKind, WalletInfo>> = {
  metamask: describe(metamask),
  phantom: describe(phantom),
  rabby: describe(rabby),
  slush: describe(slush),
  solflare: describe(solflare),
};
