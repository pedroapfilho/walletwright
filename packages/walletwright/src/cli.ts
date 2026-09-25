#!/usr/bin/env node
import { realpath } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { z } from "zod";

import { buildCache } from "./internal/cache";
import type { WalletKind, WalletSetup } from "./types";
import { isWalletKind, walletKinds } from "./wallets/index";

const HELP = `walletwright: build the onboarded wallet cache for Playwright tests

Usage:
  walletwright cache --setup <file> [--wallet <kind>]
  walletwright cache --wallet <${walletKinds.join("|")}> --seed "<phrase>" --password "<pw>" [--version <v>]

Options:
  --setup <file>     Build every WalletSetup the module exports, named or default (.ts works on modern Node)
  --wallet <kind>    ${walletKinds.join(" | ")}; with --setup, builds only that wallet's setups
  --seed <phrase>    seed phrase to import
  --password <pw>    wallet password
  --version <v>      pin an extension version (MetaMask)
  --cache-dir <dir>  cache directory (default: .walletwright)
  --headless         build the cache headless
  -h, --help         show this help

--setup carries the credentials, so it cannot be combined with --seed/--password/--version;
--wallet and --cache-dir work with either form. A value that begins with "-" needs the --flag=value
spelling. Setups from one file build one after another.

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

/** The flags a `--setup` file makes redundant: accepting both silently discarded one of the two. */
const SETUP_CONFLICTS = ["password", "seed", "version"] as const;

type Command =
  | { kind: "help" }
  | { headless: boolean; kind: "cache"; setups: ReadonlyArray<WalletSetup> };

const nonEmptyStringSchema = z.string().min(1);
const walletSetupSchema = z.object({
  cacheDir: nonEmptyStringSchema.optional(),
  password: nonEmptyStringSchema,
  seedPhrase: nonEmptyStringSchema,
  version: nonEmptyStringSchema.optional(),
  wallet: z.enum(walletKinds),
});
const moduleSchema = z.record(z.string(), z.unknown());

const isNonEmptyString = (value: string | undefined): value is string =>
  value !== undefined && nonEmptyStringSchema.safeParse(value).success;

/** Every `WalletSetup` a module exports, named or default, once each and in export order. */
const loadSetups = async (file: string): Promise<Array<WalletSetup>> => {
  const exported = moduleSchema.parse(await import(pathToFileURL(path.resolve(file)).href));
  const seen = new Set<unknown>();
  const setups: Array<WalletSetup> = [];
  for (const [name, value] of Object.entries(exported)) {
    // The field's presence marks a candidate; the full schema validates its value below.
    if (seen.has(value) || typeof value !== "object" || value === null || !("wallet" in value)) {
      continue;
    }
    seen.add(value);
    const result = walletSetupSchema.safeParse(value);
    if (!result.success) {
      throw new Error(
        `[walletwright] ${file}: export "${name}" is not a valid WalletSetup\n${z.prettifyError(result.error)}`,
      );
    }
    setups.push(result.data);
  }
  if (setups.length === 0) {
    throw new Error(`[walletwright] ${file} exports no WalletSetup`);
  }
  return setups;
};

/** `--wallet`, narrowed to a supported kind; absent or empty means unset. */
const walletFlag = (value: string | undefined): WalletKind | undefined => {
  if (!isNonEmptyString(value)) {
    return undefined;
  }
  if (!isWalletKind(value)) {
    throw new Error(
      `[walletwright] unknown --wallet "${value}". Expected one of: ${walletKinds.join(", ")}.`,
    );
  }
  return value;
};

const resolveSetups = async (flags: Flags): Promise<Array<WalletSetup>> => {
  const withCacheDir = (setup: WalletSetup): WalletSetup =>
    isNonEmptyString(flags["cache-dir"]) ? { ...setup, cacheDir: flags["cache-dir"] } : setup;
  const wallet = walletFlag(flags.wallet);

  if (isNonEmptyString(flags.setup)) {
    const redundant = SETUP_CONFLICTS.filter((name) => flags[name] !== undefined);
    if (redundant.length > 0) {
      throw new Error(
        `[walletwright] --setup carries the credentials, so --${redundant.join(", --")} would be ignored. Pass one or the other.`,
      );
    }
    const setups = await loadSetups(flags.setup);
    const selected = setups.filter((setup) => wallet === undefined || setup.wallet === wallet);
    if (selected.length === 0) {
      throw new Error(`[walletwright] ${flags.setup} exports no ${wallet} WalletSetup`);
    }
    return selected.map(withCacheDir);
  }

  const { password, seed } = flags;
  if (wallet === undefined || !isNonEmptyString(seed) || !isNonEmptyString(password)) {
    throw new Error(
      "[walletwright] provide --setup <file> or --wallet/--seed/--password. See --help.",
    );
  }
  const base: WalletSetup = { password, seedPhrase: seed, wallet };
  return [
    withCacheDir(isNonEmptyString(flags.version) ? { ...base, version: flags.version } : base),
  ];
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
  const command = parsed.positionals.at(0);
  const extra = parsed.positionals.slice(1);

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

  return { headless: flags.headless === true, kind: "cache", setups: await resolveSetups(flags) };
};

const main = async (): Promise<void> => {
  const command = await parseArgv(process.argv.slice(2));
  if (command.kind === "help") {
    process.stdout.write(HELP);
    return;
  }

  for (const setup of command.setups) {
    process.stdout.write(`[walletwright] building ${setup.wallet} cache…\n`);
    const profileDir = await buildCache(setup, { headless: command.headless });
    process.stdout.write(`[walletwright] cache ready: ${profileDir}\n`);
  }
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

export { isEntryPoint, parseArgv, resolveSetups };
