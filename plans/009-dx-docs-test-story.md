# Plan 009: Fix the fresh-clone test story and the stale MetaMask (EVM) claims

> **Executor instructions**: Follow step by step; run every verification command and confirm the
> expected result. STOP conditions halt you. Do not update `plans/README.md`; the reviewer maintains
> it.
>
> **Drift check (run first)**: `git diff --stat 0060500..HEAD -- package.json apps/demo/package.json README.md AGENTS.md packages/walletwright/README.md packages/walletwright/src/cli.ts apps/docs`
> Empty (your base IS 0060500) means no drift; proceed.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx + docs
- **Planned at**: commit `0060500`, 2026-07-17
- **PR grouping**: one PR (branch `improve-dx-docs`)

## Why this matters

Three first-contact traps. (1) Root `pnpm test` fans out to the demo's headed Playwright suite
(needs a display, built caches, and anvil for four specs), while CI's test gate runs only
`pnpm turbo run test --filter=walletwright`; a contributor running `pnpm test` hits a multi-minute
hang. (2) The network/transaction specs require a local chain on 127.0.0.1:8545, and no doc mentions
it, so a fresh clone gets silent 30s timeouts. (3) Five surfaces still say "MetaMask (EVM)" though
MetaMask now drives EVM + Solana (`metamask.ts` declares `ecosystems: ["evm", "svm"]`), and
`wallets.mdx` contradicts itself (frontmatter says EVM, body says EVM + Solana). Also the CLI
`--help` omits `slush` and says "JS/MJS module" while the docs use `.ts`, and `--seed`/`--password`
on argv deserve a visibility note.

## Current state

- Root `package.json` has `"test": "turbo run test"`. `apps/demo/package.json` has
  `"test": "playwright test"` and no unit/e2e split. `.github/workflows/test.yml:19` runs
  `pnpm turbo run test --filter=walletwright`.
- `apps/demo/tests/metamask-network.spec.ts:8` and `metamask-transaction.spec.ts:10` state the
  127.0.0.1:8545 chain-id 31337 requirement in comments only.
- Stale "MetaMask (EVM)" strings: `packages/walletwright/README.md:3`, `AGENTS.md:8`,
  `apps/docs/app/layout.tsx:9`, `apps/docs/content/docs/index.mdx:3` (frontmatter description),
  `apps/docs/content/docs/wallets.mdx:3` (frontmatter). Ignore anything under `apps/docs/.next/`
  (build artifacts).
- `packages/walletwright/src/cli.ts` HELP text (lines ~10-20) lists `--wallet <metamask|phantom>`
  and "JS/MJS module".
- Root `README.md` documents `pnpm test` as "unit tests and the demo E2E".

Conventions: no long dash (U+2014) anywhere; docs are second person, present tense; conventional
commits.

## Commands you will need

| Purpose       | Command (repo root)                    | Expected                             |
| ------------- | -------------------------------------- | ------------------------------------ |
| Typecheck     | `pnpm turbo typecheck --force`         | all tasks successful, no `error TS`  |
| Lint          | `pnpm turbo lint`                      | 0 warnings 0 errors everywhere       |
| Unit tests    | `pnpm --filter walletwright test`      | 21 passed                            |
| Format        | `pnpm format` then `pnpm format:check` | correct format                       |
| Docs build    | `pnpm --filter docs build`             | Compiled successfully                |
| New root test | `pnpm test`                            | finishes in seconds, unit tests only |

## Scope

**In scope**: root `package.json`, `apps/demo/package.json`, root `README.md`, `AGENTS.md`,
`packages/walletwright/README.md`, `apps/docs/app/layout.tsx`,
`apps/docs/content/docs/{index.mdx,wallets.mdx,continuous-integration.mdx}`,
`packages/walletwright/src/cli.ts` (HELP string only).

**Out of scope**: `turbo.json`; the demo specs; `playwright.config.ts`; anything under
`apps/docs/.next/`; the CLI's flag parsing logic.

## Git workflow

Branch `improve-dx-docs` off the base commit. One commit:
`fix(dx): split unit vs e2e test scripts, document the anvil prerequisite, refresh stale claims`.
Do NOT push.

## Steps

### Step 1: Split the test scripts

In `apps/demo/package.json`, rename `"test"` to `"test:e2e"` (same `playwright test` command). Root
`package.json`: keep `"test": "turbo run test"` (which then reaches only packages defining `test`,
i.e. walletwright's vitest) and add `"test:e2e": "pnpm --filter demo test:e2e"`.

**Verify**: `pnpm test` completes in seconds with only the walletwright unit suite (21 passed);
`pnpm turbo run test --filter=walletwright` still passes (CI parity).

### Step 2: Document the anvil prerequisite and the split

Root `README.md`: update the demo run recipe to name the split (`pnpm test` = fast unit tests,
`pnpm test:e2e` = headed extension specs) and add the prerequisite line for the network/transaction
specs: Foundry's `anvil` on 127.0.0.1:8545 with the public test mnemonic, or `createLocalChain()`
from `walletwright/chain`. `AGENTS.md` dev-workflow section: the same two facts, one line each.
`apps/docs/content/docs/continuous-integration.mdx`: a short note that the network/transaction specs
additionally need an anvil node and are typically excluded on CI.

**Verify**: `grep -rn "anvil" README.md AGENTS.md apps/docs/content/docs/continuous-integration.mdx`
shows the new mentions; `grep -c $'—' <each edited file>` returns 0 (no long dash).

### Step 3: Refresh "MetaMask (EVM)" to "MetaMask (EVM + Solana)"

Apply in exactly the five places listed in Current state.

**Verify**: `grep -rn "MetaMask (EVM)" README.md AGENTS.md packages/walletwright/README.md apps/docs/app apps/docs/content`
returns no matches.

### Step 4: Fix the CLI help text

In `cli.ts` HELP only: `--wallet <metamask|phantom|slush>`; replace "JS/MJS module" with wording
matching the docs (a module that default-exports a `WalletSetup`; `.ts` works on modern Node); add
one line noting `--seed`/`--password` appear in shell history and process lists, so use test values
(the `--setup` file form avoids argv).

**Verify**: `pnpm --filter walletwright build` then `node packages/walletwright/dist/cli.mjs --help`
prints the updated text including `slush`.

### Step 5: Full gate

**Verify**: typecheck (forced), lint, unit tests, `pnpm format:check`, docs build, per the table.

## Done criteria

- [ ] `pnpm test` runs only unit tests and passes in seconds
- [ ] `apps/demo` exposes `test:e2e`; root exposes `test:e2e`
- [ ] anvil prerequisite documented in README, AGENTS.md, and the CI docs page
- [ ] zero `MetaMask (EVM)` matches outside `.next`
- [ ] CLI `--help` lists slush, drops "JS/MJS", carries the argv-visibility note
- [ ] full gate green; no long dashes introduced
- [ ] `git status` clean apart from in-scope files

## STOP conditions

- Renaming the demo test script breaks a turbo reference you cannot resolve by the rename itself.
- Any in-scope excerpt does not match the live file.

## Maintenance notes

- If a Playwright project/tag split lands later (mock-only subset), fold its script here.
- Reviewer: confirm CI's `--filter=walletwright` gate is unaffected and `pnpm test` launches no
  browser.
