#!/usr/bin/env node
import { realpath } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { z } from "zod";

import { buildCache } from "./internal/cache";
import type { WalletSetup } from "./types";
import { isWalletKind, wallets } from "./wallets/index";

const KINDS = Object.keys(wallets);

const HELP = `walletwright: build the onboarded wallet cache for Playwright tests

Usage:
  walletwright cache --setup <file>            Build cache from a module's default-exported WalletSetup
  walletwright cache --wallet <${KINDS.join("|")}> --seed "<phrase>" --password "<pw>" [--version <v>]

Options:
  --setup <file>     A module whose default export is a WalletSetup (.ts works on modern Node)
  --wallet <kind>    ${KINDS.join(" | ")}
  --seed <phrase>    seed phrase to import
  --password <pw>    wallet password
  --version <v>      pin an extension version
  --cache-dir <dir>  cache directory (default: .walletwright)
  --headless         build the cache headless
  -h, --help         show this help

--setup carries the whole setup, so it cannot be combined with --wallet/--seed/--password/--version;
--cache-dir works with either form. A value that begins with "-" needs the --flag=value spelling.

--seed and --password are visible in shell history and process lists when passed as flags; use
test-only values, or prefer --setup <file> to keep them out of argv.
`;

/** `parseArgs` schema; strict mode rejects unknown, missing, or misplaced flag values. */
const OPTIONS = {
  "cache-dir": { type: "string" },
  headless: { type: "boolean" },
  help: { short: "h", type: "boolean" },
  password: { type: "string" },
  seed: { type: "string" },
  setup: { type: "string" },
  version: { type: "string" },
  wallet: { type: "string" },
} as const;

type Flags = {
  "cache-dir"?: string;
  headless?: boolean;
  help?: boolean;
  password?: string;
  seed?: string;
  setup?: string;
  version?: string;
  wallet?: string;
};

/** The flags `--setup` makes redundant: accepting both silently discarded one of the two. */
const SETUP_CONFLICTS = ["password", "seed", "version", "wallet"] as const;

type Command = { kind: "help" } | { headless: boolean; kind: "cache"; setup: WalletSetup };

const nonEmptyStringSchema = z.string().min(1);
const walletSetupSchema = z.object({
  cacheDir: nonEmptyStringSchema.optional(),
  password: nonEmptyStringSchema,
  seedPhrase: nonEmptyStringSchema,
  version: nonEmptyStringSchema.optional(),
  wallet: z.enum(["metamask", "phantom", "rabby", "slush", "solflare"]),
});
const setupModuleSchema = z.object({ default: walletSetupSchema });

const isNonEmptyString = (value: string | undefined): value is string =>
  value !== undefined && nonEmptyStringSchema.safeParse(value).success;

const loadSetup = async (file: string): Promise<WalletSetup> => {
  const resolved = pathToFileURL(path.resolve(file)).href;
  const result = setupModuleSchema.safeParse(await import(resolved));
  if (!result.success) {
    throw new Error(`[walletwright] ${file} must default-export a WalletSetup`);
  }
  return result.data.default;
};

const resolveSetup = async (flags: Flags): Promise<WalletSetup> => {
  const withCacheDir = (setup: WalletSetup): WalletSetup =>
    isNonEmptyString(flags["cache-dir"]) ? { ...setup, cacheDir: flags["cache-dir"] } : setup;

  if (isNonEmptyString(flags.setup)) {
    const redundant = SETUP_CONFLICTS.filter((name) => flags[name] !== undefined);
    if (redundant.length > 0) {
      throw new Error(
        `[walletwright] --setup carries the whole setup, so --${redundant.join(", --")} would be ignored. Pass one or the other.`,
      );
    }
    return withCacheDir(await loadSetup(flags.setup));
  }

  const { password, seed, wallet } = flags;
  if (!isNonEmptyString(wallet) || !isNonEmptyString(seed) || !isNonEmptyString(password)) {
    throw new Error(
      "[walletwright] provide --setup <file> or --wallet/--seed/--password. See --help.",
    );
  }
  if (!isWalletKind(wallet)) {
    throw new Error(
      `[walletwright] unknown --wallet "${wallet}". Expected one of: ${KINDS.join(", ")}.`,
    );
  }
  const base: WalletSetup = { password, seedPhrase: seed, wallet };
  return withCacheDir(isNonEmptyString(flags.version) ? { ...base, version: flags.version } : base);
};

const parseArgv = async (argv: Array<string>): Promise<Command> => {
  let parsed;
  try {
    parsed = parseArgs({ allowPositionals: true, args: argv, options: OPTIONS, strict: true });
  } catch (error) {
    // node's ERR_PARSE_ARGS_* messages are good; they just need the prefix everything else here has.
    throw new Error(`[walletwright] ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    });
  }

  const flags: Flags = parsed.values;
  const [command, ...extra] = parsed.positionals;

  if (flags.help === true || command === undefined || command === "help") {
    return { kind: "help" };
  }
  if (command !== "cache") {
    throw new Error(`[walletwright] unknown command "${command}". Run \`walletwright --help\`.`);
  }
  if (extra.length > 0) {
    throw new Error(
      `[walletwright] unexpected argument "${extra[0]}". Run \`walletwright --help\`.`,
    );
  }

  return { headless: flags.headless === true, kind: "cache", setup: await resolveSetup(flags) };
};

const main = async (): Promise<void> => {
  const command = await parseArgv(process.argv.slice(2));
  if (command.kind === "help") {
    process.stdout.write(HELP);
    return;
  }

  process.stdout.write(`[walletwright] building ${command.setup.wallet} cache…\n`);
  const profileDir = await buildCache(command.setup, { headless: command.headless });
  process.stdout.write(`[walletwright] cache ready: ${profileDir}\n`);
};

/** Resolve the CLI symlink before comparing `process.argv[1]` with `import.meta.url`. */
const isEntryPoint = async (moduleUrl: string, entryPath: string | undefined): Promise<boolean> =>
  entryPath !== undefined && moduleUrl === pathToFileURL(await realpath(entryPath)).href;

if (await isEntryPoint(import.meta.url, process.argv[1])) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    // Not process.exit(1): writes to a piped stderr are async and exit() does not flush them, so
    // `walletwright cache … 2>&1 | tee build.log` could exit 1 with an empty diagnostic. Nothing runs
    // after this block, so the process ends on its own once the write drains.
    process.exitCode = 1;
  }
}

export { isEntryPoint, parseArgv, resolveSetup };
