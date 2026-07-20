# Plan 018: Harden the `walletwright cache` CLI flag handling

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If anything in "STOP conditions" occurs, stop and
> report. When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 993e798..HEAD -- packages/walletwright/src/cli.ts`
> If it changed, compare the "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plan 017 (which exports `parseFlags` and pins current parser behavior with tests)
- **Category**: bug
- **Planned at**: commit `993e798`, 2026-07-20

## Why this matters

Two CLI edge bugs make `walletwright cache` fail confusingly:

1. A value-less flag becomes boolean `true`, then flows into `setup` via `as string`. So
   `walletwright cache --wallet metamask --seed --password pw` passes the `flags.wallet && flags.seed
&& flags.password` gate with `seed === true`, and downstream `seedPhrase.trim()` throws "trim is
   not a function" (or an invalid `wallet` indexes `wallets[...]` as `undefined`). The user gets an
   opaque runtime error instead of "missing/invalid --seed".
2. `--cache-dir` is merged into `setup` only on the `--wallet/--seed/--password` branch. On the
   `--setup <file>` branch it is silently dropped, so `walletwright cache --setup s.ts --cache-dir
./ci-cache` builds into the wrong directory and a later `launchWalletContext` reports "no cache for
   this setup".

## Current state

- `packages/walletwright/src/cli.ts:68-83`:

```ts
let setup: WalletSetup;
if (typeof flags.setup === "string") {
  setup = await loadSetup(flags.setup);
} else if (flags.wallet && flags.seed && flags.password) {
  setup = {
    password: flags.password as string,
    seedPhrase: flags.seed as string,
    wallet: flags.wallet as WalletKind,
    ...(typeof flags.version === "string" ? { version: flags.version } : {}),
    ...(typeof flags["cache-dir"] === "string" ? { cacheDir: flags["cache-dir"] } : {}),
  };
} else {
  throw new Error(
    "[walletwright] provide --setup <file> or --wallet/--seed/--password. See --help.",
  );
}
```

- Valid wallet kinds live in `src/types.ts:10`: `type WalletKind = "metamask" | "phantom" | "slush"`.
  The registry `src/wallets/index.ts` exports `wallets` keyed by `WalletKind`; `Object.keys(wallets)`
  is the runtime list.

## Commands you will need

| Purpose    | Command                                     | Expected on success |
| ---------- | ------------------------------------------- | ------------------- |
| Install    | `pnpm install`                              | exit 0              |
| Unit tests | `pnpm turbo run test --filter=walletwright` | all pass            |
| Typecheck  | `pnpm typecheck`                            | exit 0              |
| Lint       | `pnpm lint`                                 | exit 0              |
| Build      | `pnpm --filter walletwright build`          | exit 0              |

## Scope

**In scope** (only files you should modify):

- `packages/walletwright/src/cli.ts`
- `packages/walletwright/src/cli.test.ts` (extend the file created in plan 017)

**Out of scope** (do NOT touch):

- `buildCache`, `launchWalletContext`, or the wallet definitions.
- The `--seed`/`--password` argv-visibility warning in the help text (that is an acknowledged
  tradeoff, not part of this plan).

## Git workflow

- Branch: `improve-cli-flag-hardening`.
- Conventional-commit message, e.g. `fix(cli): validate flag values and honor --cache-dir with --setup`.
- Do NOT push or open a PR unless the operator asks.

## Steps

### Step 1: Validate the `--wallet/--seed/--password` branch

Before constructing `setup` in that branch, assert each required flag is a non-empty string and that
`wallet` is a known `WalletKind`. On failure, throw a clear message pointing at `--help`. Target
shape:

```ts
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

// in the else-if branch, replace the truthy gate:
} else if (isNonEmptyString(flags.wallet) && isNonEmptyString(flags.seed) && isNonEmptyString(flags.password)) {
  const kinds = Object.keys(wallets) as Array<WalletKind>;
  if (!kinds.includes(flags.wallet as WalletKind)) {
    throw new Error(`[walletwright] unknown --wallet "${flags.wallet}". Expected one of: ${kinds.join(", ")}.`);
  }
  setup = {
    password: flags.password,
    seedPhrase: flags.seed,
    wallet: flags.wallet as WalletKind,
    ...(typeof flags.version === "string" ? { version: flags.version } : {}),
    ...(typeof flags["cache-dir"] === "string" ? { cacheDir: flags["cache-dir"] } : {}),
  };
}
```

Import `wallets` from `./wallets/index.ts`. With the `isNonEmptyString` guards the `as string` casts
on `password`/`seed` are no longer needed (the type is narrowed). Keep the final `else` that throws
the "provide --setup or --wallet/--seed/--password" message.

**Verify**: `pnpm typecheck` exit 0; `pnpm lint` exit 0.

### Step 2: Honor `--cache-dir` on the `--setup` branch

When `--cache-dir` is provided alongside `--setup`, overlay it onto the loaded setup:

```ts
if (typeof flags.setup === "string") {
  const loaded = await loadSetup(flags.setup);
  setup =
    typeof flags["cache-dir"] === "string" ? { ...loaded, cacheDir: flags["cache-dir"] } : loaded;
}
```

**Verify**: `pnpm typecheck` exit 0.

### Step 3: Extend the CLI tests

In `cli.test.ts` (from plan 017), refactor `main`'s setup-assembly into a small testable pure function
if it is not already testable, OR test the validation via `parseFlags` + a thin helper. At minimum add
cases:

- A value-less required flag (`--wallet metamask --seed --password pw`) is rejected with a clear error
  (not a boolean coercion).
- An unknown `--wallet foo` is rejected listing valid kinds.
- `--cache-dir` provided with `--setup` ends up on the resulting `setup.cacheDir`.

If testing requires extracting the setup-assembly logic from `main` into an exported helper (e.g.
`resolveSetup(flags)`), that is in scope; keep `main` a thin wrapper over it.

**Verify**: `pnpm turbo run test --filter=walletwright` all pass.

### Step 4: Confirm build

**Verify**: `pnpm --filter walletwright build` exit 0.

## Test plan

- Extend `cli.test.ts` with the three cases in Step 3. Structural pattern: existing tests in that file
  (created in plan 017) and `utils.test.ts`.
- Update the plan-017 boolean-coercion test to assert the new reject behavior for a value-less
  required flag.
- Verification: `pnpm turbo run test --filter=walletwright` all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `walletwright cache --wallet metamask --seed --password pw` throws a clear validation error (a
      unit test asserts this via the extracted helper)
- [ ] An unknown `--wallet` value is rejected with the list of valid kinds
- [ ] `--cache-dir` is applied on the `--setup` branch (a unit test asserts `setup.cacheDir`)
- [ ] `pnpm turbo run test --filter=walletwright` exits 0
- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm --filter walletwright build` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report (do not improvise) if:

- `cli.ts` no longer matches the "Current state" excerpt (it was refactored, e.g. adopted a real arg
  parser library since this plan).
- Plan 017 has not landed and `parseFlags` is not exported (do 017 first, or export it as part of
  this change and note the overlap).

## Maintenance notes

- If the CLI later adopts an arg-parsing library, this bespoke validation folds into that library's
  schema; keep the "known wallet kind" check.
- A reviewer should confirm no `as string` cast remains on a value that could be boolean.
