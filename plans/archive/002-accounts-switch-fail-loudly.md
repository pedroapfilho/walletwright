# Plan 002: Make `accounts.switch` fail loudly instead of swallowing a failed switch

> **Executor instructions**: Follow step by step; run every verification command and confirm the
> expected result before the next step. If a STOP condition occurs, stop and report. Update the
> status row in `plans/README.md` when done, unless a reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat 0f0db25..HEAD -- packages/walletwright/src/wallets/metamask/actions/accounts.ts`
> If the file changed, compare against the "Current state" excerpt; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `0f0db25`, 2026-07-16

## Why this matters

`accounts.switch(index)` clicks an account cell, then waits for the account menu to close. If the
menu does not close within 10s, the current code catches the timeout and calls `closeAccountMenu`,
then resolves successfully. So a switch that never actually happened (wrong index, click missed,
MetaMask reordered cells) reads as a passing action. Tests that switch accounts then assert on the
new account get a false green: the assertion runs against the old account and may still pass by
coincidence, or the failure surfaces far from its cause. A switch that did not switch must throw.

## Current state

- `packages/walletwright/src/wallets/metamask/actions/accounts.ts` holds the MetaMask account
  actions. `switchTo` is the offender.

Excerpt (`accounts.ts:59-67`):

```ts
const switchTo = async ({ home }: WalletActionContext, index: number): Promise<void> => {
  await openAccountMenu(home);
  await home.getByTestId("account-cell-avatar").nth(index).click();
  // Selecting an account closes the menu and makes it active.
  await home
    .getByTestId("add-multichain-account-button")
    .waitFor({ state: "hidden", timeout: 10_000 })
    .catch(() => closeAccountMenu(home));
};
```

Helper for context (`accounts.ts:5-15`):

```ts
const openAccountMenu = async (home: Page): Promise<void> => {
  await home.bringToFront();
  await home.getByTestId("account-menu-icon").click();
  await home.getByTestId("add-multichain-account-button").waitFor({ state: "visible" });
};

/** The menu is a popover with no close affordance; going home is the reliable way out. */
const closeAccountMenu = async (home: Page): Promise<void> => {
  await home.goto(`${home.url().split("#")[0]}#/`);
  await home.getByTestId("account-menu-icon").waitFor({ state: "visible" });
};
```

Verified fact (from the account-menu discovery during development): the account switcher trigger is
`account-menu-icon`, and its rendered text is the active account's name (e.g. "Account 1",
"Account 2"). Selecting a cell closes the menu (the `add-multichain-account-button`, only present
while the menu is open, goes hidden). The engine throws user-facing errors with the
`[walletwright] ...` prefix (see `internal/controller.ts`).

Repo conventions: arrow functions, `const` over `let`, `.ts` import extensions, comments only for a
non-obvious WHY. Never use a long dash (U+2014).

## Commands you will need

| Purpose   | Command (from repo root)               | Expected on success |
| --------- | -------------------------------------- | ------------------- |
| Typecheck | `pnpm --filter walletwright typecheck` | exit 0, no errors   |
| Lint      | `pnpm --filter walletwright lint`      | 0 warnings 0 errors |
| Build     | `pnpm --filter walletwright build`     | "Build complete"    |

## Scope

**In scope**:

- `packages/walletwright/src/wallets/metamask/actions/accounts.ts`

**Out of scope** (do NOT touch):

- `add`, `importPrivateKey`, `rename` in the same file. Only `switchTo` changes.
- `internal/controller.ts` and the `AccountActions` type; the signature stays
  `(ctx, index) => Promise<void>`.
- The demo specs; they are verified separately by the reviewer.

## Git workflow

- Commit, conventional style: `fix(walletwright): throw when accounts.switch fails to switch`.
- Do NOT push or open a PR.

## Steps

### Step 1: Replace the swallow with a real success check

Rewrite `switchTo` so that after clicking the cell it waits for the menu to close, and if the menu
does not close, it throws a clear error naming the index rather than silently calling
`closeAccountMenu`. Keep `openAccountMenu` and `closeAccountMenu` untouched.

Target shape:

```ts
const switchTo = async ({ home }: WalletActionContext, index: number): Promise<void> => {
  await openAccountMenu(home);
  await home.getByTestId("account-cell-avatar").nth(index).click();
  // Selecting an account closes the menu and makes it active; if the menu is still open, the
  // switch did not happen (bad index, missed click), which must be an error, not a silent no-op.
  const menuClosed = await home
    .getByTestId("add-multichain-account-button")
    .waitFor({ state: "hidden", timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  if (!menuClosed) {
    throw new Error(`[walletwright] accounts.switch(${index}) did not switch (menu stayed open)`);
  }
};
```

**Verify**: `pnpm --filter walletwright typecheck` → exit 0.

### Step 2: Lint and build

**Verify**: `pnpm --filter walletwright lint` → 0 warnings 0 errors; `pnpm --filter walletwright build`
→ "Build complete".

## Test plan

No CI-runnable unit test: `switchTo` drives a browser page and the vitest suite is browser-free. The
behavior is covered by the headed spec `apps/demo/tests/metamask-accounts.spec.ts` (out of scope,
verified by the reviewer). Do not add a browser test here.

## Done criteria

ALL must hold:

- [ ] `pnpm --filter walletwright typecheck` exits 0
- [ ] `pnpm --filter walletwright lint` reports 0 warnings, 0 errors
- [ ] `pnpm --filter walletwright build` prints "Build complete"
- [ ] `grep -n "catch(() => closeAccountMenu" packages/walletwright/src/wallets/metamask/actions/accounts.ts`
      returns no matches (the swallow is gone)
- [ ] `switchTo` throws an error containing `accounts.switch(` when the menu stays open
- [ ] `git status` shows only `accounts.ts` modified
- [ ] `plans/README.md` row for 002 updated (unless the reviewer maintains it)

## STOP conditions

Stop and report if:

- The `switchTo` excerpt does not match the live code (drift).
- Removing the `closeAccountMenu` fallback makes typecheck complain that `closeAccountMenu` is now
  unused: it is still used by `add`, `importPrivateKey`, and `rename`, so this should not happen; if
  it does, you edited the wrong function, revert and re-read.

## Maintenance notes

- If MetaMask changes the account menu so `add-multichain-account-button` is no longer the
  menu-open signal, this check needs a new signal (e.g. the account list dialog going hidden).
- Reviewer: confirm the error path is reachable (menu-open case) and that the three other actions
  still compile and still use `closeAccountMenu`.
