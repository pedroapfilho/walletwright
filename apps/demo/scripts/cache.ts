import { buildCache, isWalletKind } from "@walletwright/core";
import type { WalletKind } from "@walletwright/core";

import { walletSetups } from "../wallet-setup";

const KINDS = Object.keys(walletSetups) as Array<WalletKind>;

const asKind = (name: string): WalletKind => {
  if (!isWalletKind(name)) {
    throw new Error(`usage: pnpm test:cache [${KINDS.join("|")}] (unknown wallet: ${name})`);
  }
  return name;
};

const headless = process.argv.includes("--headless");
const named = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));

/**
 * Named wallets, or all of them. One entrypoint so the list of wallets to onboard lives only in
 * `wallet-setup.ts`, which the compiler keeps exhaustive over `WalletKind`. CI used to hardcode its
 * own copy in a bash loop, so a newly registered wallet would run its spec against a cache CI never
 * built and fail on the runner with "no cache for this setup", which reads as a profile bug.
 */
const selected = named.length > 0 ? named.map(asKind) : KINDS;

for (const name of selected) {
  process.stdout.write(`building ${name} cache…\n`);
  const dir = await buildCache(walletSetups[name], { headless });
  process.stdout.write(`  → ${dir}\n`);
}
