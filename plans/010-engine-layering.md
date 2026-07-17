# Plan 010: Engine layering: relocate the MetaMask patch, centralize tab focus

> **Executor instructions**: Follow step by step; verify each step. STOP conditions halt you. Do not
> update `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 0060500..HEAD -- packages/walletwright/src`
> Empty means no drift; proceed.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED (behavioral change on the shared action path; must re-verify headed)
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `0060500`, 2026-07-17
- **PR grouping**: one PR (branch `improve-engine-layering`)

## Why this matters

Two layering leaks. (1) `internal/onboarding-patch.ts` is entirely MetaMask-specific (leveldb
`completedOnboarding` patching) yet lives in the wallet-agnostic engine directory; its only importer
is `wallets/metamask.ts`. The repo's convention (AGENTS.md) keeps wallet helpers in the wallet's own
folder. (2) The engine re-fronts the dapp AFTER every capability action (`controller.ts` `action()`),
but each MetaMask action must remember to `home.bringToFront()` BEFORE driving the wallet page
(4 copies: accounts.ts:6, network.ts:9, settings.ts:6 and :14). Forgetting the pre-front fails
silently (approvals render inline in the extension tab and the popup engine cannot find them).
Centralizing both halves in `action()` makes the invariant structural. Bonus: the comment in
`wallets/metamask/approve.ts` claims the `.or()` chain tries selectors "in order"; Playwright's
`.or().first()` resolves by DOM order, so correct the comment (no behavior change).

## Current state

- `packages/walletwright/src/internal/onboarding-patch.ts`: exports `markMetaMaskOnboarded`;
  imported once at `packages/walletwright/src/wallets/metamask.ts:2` as
  `import { markMetaMaskOnboarded } from "../internal/onboarding-patch.ts";`.
- `packages/walletwright/src/internal/controller.ts` `action()` (lines ~91-103): invokes
  `fn(ctx, ...args)` then re-fronts the dapp:
  `context.pages().find((page) => /^https?:/v.test(page.url()) && !page.isClosed())` +
  `bringToFront().catch(() => {})`.
- Pre-front call sites to remove: `wallets/metamask/actions/accounts.ts:6` (in `openAccountMenu`),
  `wallets/metamask/actions/network.ts:9` (in `openNetworkManager`),
  `wallets/metamask/actions/settings.ts` lock and unlock (both call `home.bringToFront()`).
- `wallets/metamask/approve.ts` comment block above `approve` says selectors are tried together;
  `reject`'s doc comment says "in the same order".

Conventions: `.ts` import extensions, arrow functions, comments only for non-obvious WHY, no long
dash (U+2014), conventional commits.

## Commands you will need

| Purpose       | Command (repo root)                | Expected       |
| ------------- | ---------------------------------- | -------------- |
| Typecheck     | `pnpm turbo typecheck --force`     | no error TS    |
| Lint          | `pnpm --filter walletwright lint`  | 0/0            |
| Unit tests    | `pnpm --filter walletwright test`  | 21 passed      |
| Build         | `pnpm --filter walletwright build` | Build complete |
| Headed verify | see Step 4                         | specs pass     |

## Scope

**In scope**: `packages/walletwright/src/internal/onboarding-patch.ts` (move to
`packages/walletwright/src/wallets/metamask/onboarding-patch.ts`), `wallets/metamask.ts` (import
path), `internal/controller.ts` (action pre-front), `wallets/metamask/actions/{accounts,network,settings}.ts`
(remove pre-front lines), `wallets/metamask/approve.ts` (comment only).

**Out of scope**: any behavior of the popup resolution (`resolvePopup`); the selector chains
themselves; `launch.ts`; the demo app.

## Git workflow

Branch `improve-engine-layering` off base. One commit:
`refactor(walletwright): move MetaMask onboarding patch into its wallet folder, centralize tab focus`.
Do NOT push.

## Steps

### Step 1: Relocate the patch file

`git mv packages/walletwright/src/internal/onboarding-patch.ts packages/walletwright/src/wallets/metamask/onboarding-patch.ts`
and update the import in `wallets/metamask.ts` to `./metamask/onboarding-patch.ts`. Fix the moved
file's own relative imports if any (check its imports; classic-level and node builtins need no
change; a types import would go from `../types.ts` to `../../types.ts`).

**Verify**: `pnpm turbo typecheck --force` clean; `pnpm --filter walletwright test` 21 passed.

### Step 2: Centralize the pre-front in `action()`

In `controller.ts` `action()`, before `await fn(ctx, ...args)`, add:

```ts
// Actions drive the wallet's own page; front it first so clicks land on a visible tab, then
// hand focus back to the dapp below so new approvals open as popups instead of inline.
await home.bringToFront().catch(() => {});
```

Then remove the now-redundant `home.bringToFront()` calls at `accounts.ts:6` (openAccountMenu),
`network.ts:9` (openNetworkManager), and both in `settings.ts`. Keep everything else in those
functions unchanged.

**Verify**: typecheck + lint + build clean;
`grep -rn "bringToFront" packages/walletwright/src/wallets/metamask/actions/` returns no matches.

### Step 3: Correct the approve.ts ordering comment

Adjust the `approve` doc comment to state that `.or()` unions resolve by DOM order (not chain
order) and that popups render exactly one of these buttons; make `reject`'s comment match. Comment
change only; do not touch the locators.

**Verify**: `git diff packages/walletwright/src/wallets/metamask/approve.ts` shows only comment
lines changed.

### Step 4: Headed verification (required, this is the MED-risk step)

The MetaMask cache already exists in this worktree if you are in the reviewer-provided one;
otherwise build it: `cd apps/demo && node scripts/cache-one.ts metamask --headless`. Then run the
action-driving specs headed:

```
cd apps/demo && pnpm exec playwright test tests/metamask-actions.spec.ts tests/metamask-accounts.spec.ts --retries=1
```

**Verify**: all specs pass (5 specs across the two files). These cover lock/unlock, rejects, and all
four account actions, which exercise the centralized pre-front on every action type. (The network
spec needs anvil; if `anvil` is available on PATH at ~/.foundry/bin, also start
`anvil --chain-id 31337 --mnemonic "test test test test test test test test test test test junk"`
in the background and run `tests/metamask-network.spec.ts`; if anvil is unavailable, note it in your
report and rely on the two suites above.)

## Done criteria

- [ ] `internal/onboarding-patch.ts` no longer exists; the file lives under `wallets/metamask/`
- [ ] `grep -rn "onboarding-patch" packages/walletwright/src/internal/` returns nothing
- [ ] `action()` fronts `home` before invoking the action fn; zero `bringToFront` calls remain in
      `wallets/metamask/actions/`
- [ ] approve.ts diff is comment-only
- [ ] typecheck, lint, 21 unit tests, build all green
- [ ] headed: metamask-actions + metamask-accounts specs pass
- [ ] `git status` clean apart from in-scope files

## STOP conditions

- Any headed spec fails twice in a row after the centralization: report the failing spec and diff
  rather than adding per-action workarounds.
- The moved file imports something that would create a cycle (wallets -> internal -> wallets).

## Maintenance notes

- New wallet actions no longer need to front the wallet page; document nothing, the wrapper owns it.
- Reviewer: scrutinize that no action relied on NOT fronting home (none should; all four current
  actions fronted it first already).
