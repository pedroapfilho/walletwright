# Plan 025: Fix the api-reference "everything from the package root" claim

> **Executor instructions**: Small docs fix. Run the verification command, honor STOP conditions,
> update this plan's row in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 993e798..HEAD -- apps/docs/content/docs/api-reference.mdx packages/walletwright/src/index.ts`
> On a mismatch with the excerpts below, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `993e798`, 2026-07-20

## Why this matters

`api-reference.mdx:6` opens with "Everything is exported from the package root," but the same page then
documents `walletwright/chain` (`createLocalChain`) and `walletwright/mock` (`installMockWallet`) as
separate subpath entry points, and `src/index.ts` confirms neither `createLocalChain` nor
`installMockWallet` is a root export. A reader who trusts the opening line will write `import {
installMockWallet } from "walletwright"` and get a resolution error.

## Current state

- `apps/docs/content/docs/api-reference.mdx:6`:

```
Everything is exported from the package root:
```

- `packages/walletwright/src/index.ts` (the actual root exports):

```ts
export { buildCache } from "./internal/cache.ts";
export { launchWallet, type LaunchedWallet } from "./internal/launch.ts";
export { createWalletFixtures, type WalletFixtures } from "./fixtures.ts";
export { wallets, walletKindsByEcosystem } from "./wallets/index.ts";
export type { Ecosystem, Wallet, WalletDefinition, WalletKind, WalletSetup } from "./types.ts";
```

- The same page documents the subpaths lower down: `walletwright/chain` (`api-reference.mdx:159`) and
  `walletwright/mock` (`api-reference.mdx:183`), each needing an optional peer (`prool`, `viem`).

## Commands you will need

| Purpose    | Command                    | Expected on success |
| ---------- | -------------------------- | ------------------- |
| Docs build | `pnpm --filter docs build` | exit 0              |
| Format     | `pnpm format:check`        | all formatted       |

## Scope

**In scope** (only file you should modify):

- `apps/docs/content/docs/api-reference.mdx`

**Out of scope** (do NOT touch):

- `packages/walletwright/src/index.ts` and the package `exports` map (the subpath split is by design;
  do not "fix" it by moving `installMockWallet`/`createLocalChain` to the root).

## Git workflow

- Branch: `improve-api-reference-subpath`.
- Conventional-commit message, e.g. `docs(api-reference): clarify root vs subpath entry points`.
- Do NOT push or open a PR unless the operator asks.

## Steps

### Step 1: Soften the opening line

Change `api-reference.mdx:6` to distinguish the core root exports from the optional subpaths. Target:

```
The core API is exported from the package root; `walletwright/chain` and `walletwright/mock` are
optional subpath entry points (each needs an optional peer, documented below).
```

Keep the code block that follows (the root import example) as is.

**Verify**: `pnpm --filter docs build` exit 0; `pnpm format:check` all formatted.

## Test plan

- Docs-only; verification is a clean docs build plus format check.
- Optional manual check: the `/api-reference` page renders and the opening sentence matches the
  documented subpaths.

## Done criteria

- [ ] `api-reference.mdx:6` no longer claims everything is exported from the root
- [ ] `pnpm --filter docs build` exits 0
- [ ] `pnpm format:check` reports all formatted
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if the root exports in `index.ts` changed since this plan (e.g. the subpaths were
folded into the root), which would change the correct wording.

## Maintenance notes

- If a future export is added, keep this sentence in sync with whether it is a root or subpath export.
