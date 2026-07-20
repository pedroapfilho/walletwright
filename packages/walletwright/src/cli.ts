#!/usr/bin/env node
import path from "node:path";
import { pathToFileURL } from "node:url";

import { buildCache } from "./internal/cache.ts";
import type { WalletKind, WalletSetup } from "./types.ts";
import { wallets } from "./wallets/index.ts";

const HELP = `walletwright: build the onboarded wallet cache for Playwright tests

Usage:
  walletwright cache --setup <file>            Build cache from a module's default-exported WalletSetup
  walletwright cache --wallet <metamask|phantom|slush> --seed "<phrase>" --password "<pw>" [--version <v>]

Options:
  --setup <file>     A module whose default export is a WalletSetup (.ts works on modern Node)
  --wallet <kind>    metamask | phantom | slush
  --seed <phrase>    seed phrase to import
  --password <pw>    wallet password
  --version <v>      pin an extension version
  --cache-dir <dir>  cache directory (default: .walletwright)
  --headless         build the cache headless (onboarding only; tests still need headed)
  -h, --help         show this help

--seed and --password are visible in shell history and process lists when passed as flags; use
test-only values, or prefer --setup <file> to keep them out of argv.
`;

const parseFlags = (argv: Array<string>): Record<string, string | boolean> => {
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token?.startsWith("--") && token !== "-h") {
      continue;
    }
    const key = token.replace(/^--?/v, "");
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = true;
    }
  }
  return flags;
};

const loadSetup = async (file: string): Promise<WalletSetup> => {
  const resolved = pathToFileURL(path.resolve(file)).href;
  const mod = (await import(resolved)) as { default?: WalletSetup };
  if (!mod.default) {
    throw new Error(`[walletwright] ${file} must default-export a WalletSetup`);
  }
  return mod.default;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const resolveSetup = async (flags: Record<string, string | boolean>): Promise<WalletSetup> => {
  if (typeof flags.setup === "string") {
    const loaded = await loadSetup(flags.setup);
    return typeof flags["cache-dir"] === "string"
      ? { ...loaded, cacheDir: flags["cache-dir"] }
      : loaded;
  }
  if (
    isNonEmptyString(flags.wallet) &&
    isNonEmptyString(flags.seed) &&
    isNonEmptyString(flags.password)
  ) {
    const kinds = Object.keys(wallets) as Array<WalletKind>;
    if (!kinds.includes(flags.wallet as WalletKind)) {
      throw new Error(
        `[walletwright] unknown --wallet "${flags.wallet}". Expected one of: ${kinds.join(", ")}.`,
      );
    }
    return {
      password: flags.password,
      seedPhrase: flags.seed,
      wallet: flags.wallet as WalletKind,
      ...(typeof flags.version === "string" ? { version: flags.version } : {}),
      ...(typeof flags["cache-dir"] === "string" ? { cacheDir: flags["cache-dir"] } : {}),
    };
  }
  throw new Error(
    "[walletwright] provide --setup <file> or --wallet/--seed/--password. See --help.",
  );
};

const main = async (): Promise<void> => {
  const [command, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);

  if (!command || command === "help" || flags.help || flags.h) {
    process.stdout.write(HELP);
    return;
  }
  if (command !== "cache") {
    throw new Error(`[walletwright] unknown command "${command}". Run \`walletwright --help\`.`);
  }

  const setup = await resolveSetup(flags);

  process.stdout.write(`[walletwright] building ${setup.wallet} cache…\n`);
  const profileDir = await buildCache(setup, { headless: Boolean(flags.headless) });
  process.stdout.write(`[walletwright] cache ready: ${profileDir}\n`);
};

const invokedAsCli =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedAsCli) {
  try {
    await main();
  } catch (error: unknown) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

export { parseFlags, resolveSetup };
