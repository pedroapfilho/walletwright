import { buildCache, isWalletKind } from "@walletwright/core";
import type { WalletKind } from "@walletwright/core";

import { walletSetups } from "../wallet-setup";

import { buildCaches } from "./build-caches";

const KINDS = Object.keys(walletSetups).filter(isWalletKind);

const asKind = (name: string): WalletKind => {
  if (!isWalletKind(name)) {
    throw new Error(`usage: pnpm test:cache [${KINDS.join("|")}] (unknown wallet: ${name})`);
  }
  return name;
};

const headless = process.argv.includes("--headless");
const named = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));

const selected = named.length > 0 ? named.map(asKind) : KINDS;

await buildCaches(selected, async (name) => {
  process.stdout.write(`building ${name} cache…\n`);
  const dir = await buildCache(walletSetups[name], { headless });
  process.stdout.write(`  ${name} → ${dir}\n`);
});
