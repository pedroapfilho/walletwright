import { buildCache } from "@walletwright/core";

import { walletSetups } from "../wallet-setup";

const name = process.argv[2] as keyof typeof walletSetups;
const setup = walletSetups[name];
if (!setup) {
  throw new Error(`usage: pnpm test:cache:one <${Object.keys(walletSetups).join("|")}>`);
}
const dir = await buildCache(setup, { headless: process.argv.includes("--headless") });
process.stdout.write(`${name} cache → ${dir}\n`);
