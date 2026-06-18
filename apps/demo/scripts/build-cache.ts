import { buildCache } from "walletwright";

import { metamaskSetup, phantomSetup, slushSetup } from "../wallet-setup.ts";

const headless = process.argv.includes("--headless");

for (const setup of [metamaskSetup, phantomSetup, slushSetup]) {
  process.stdout.write(`building ${setup.wallet} cache…\n`);
  const dir = await buildCache(setup, { headless });
  process.stdout.write(`  → ${dir}\n`);
}
