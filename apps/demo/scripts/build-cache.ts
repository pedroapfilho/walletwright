import { buildCache } from "@walletwright/core";

import { walletSetups } from "../wallet-setup";

const headless = process.argv.includes("--headless");

for (const setup of Object.values(walletSetups)) {
  process.stdout.write(`building ${setup.wallet} cache…\n`);
  const dir = await buildCache(setup, { headless });
  process.stdout.write(`  → ${dir}\n`);
}
