import { buildCache } from "walletwright";

import { metamaskSetup, phantomSetup, slushSetup } from "../wallet-setup.ts";

const setups = { metamask: metamaskSetup, phantom: phantomSetup, slush: slushSetup };
const name = process.argv[2] as keyof typeof setups;
const setup = setups[name];
if (!setup) {
  throw new Error(`usage: node scripts/cache-one.ts <${Object.keys(setups).join("|")}>`);
}
const dir = await buildCache(setup, { headless: process.argv.includes("--headless") });
process.stdout.write(`${name} cache → ${dir}\n`);
