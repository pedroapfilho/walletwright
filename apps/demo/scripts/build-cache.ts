import { buildCache } from "@walletwright/core";

import { metamaskSetup, phantomSetup, rabbySetup, slushSetup } from "../wallet-setup";

const headless = process.argv.includes("--headless");

for (const setup of [metamaskSetup, phantomSetup, rabbySetup, slushSetup]) {
  process.stdout.write(`building ${setup.wallet} cache…\n`);
  const dir = await buildCache(setup, { headless });
  process.stdout.write(`  → ${dir}\n`);
}
