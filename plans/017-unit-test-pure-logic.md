# Plan 017: Unit-test the CLI flag parser and the popup-matcher predicate

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If anything in "STOP conditions" occurs, stop and
> report. When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 993e798..HEAD -- packages/walletwright/src/cli.ts packages/walletwright/src/internal/utils.ts packages/walletwright/src/internal/utils.test.ts`
> If any changed, compare the "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (do this before plan 018, which changes `cli.ts` behavior; tests here pin the
  current parser first)
- **Category**: tests
- **Planned at**: commit `993e798`, 2026-07-20

## Why this matters

Two pieces of pure, browser-free logic encode hard-won behavior and have zero unit coverage today;
the only thing exercising them is the headed E2E suite, which never runs in CI. `parseFlags` is the
CLI's argv parser (the documented `walletwright cache` entry point), and `isApprovalPopup` is the URL
predicate that finds approval popups (AGENTS.md item 4: `waitForEvent('page')` misses popups; Slush
keys on `isPopup=1` while MetaMask/Phantom use `notification.html`). A regression in either silently
breaks cache-building or connect/sign detection with no compiler signal. Both are trivially testable.

## Current state

- `packages/walletwright/src/cli.ts:28-45`, `parseFlags` is module-private:

```ts
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
```

Note it supports only `--flag value` (space-separated), NOT `--flag=value`; a value-less flag or one
followed by another `--flag` becomes boolean `true`.

- `packages/walletwright/src/internal/utils.ts:58-61`, `isApprovalPopup` is module-private:

```ts
const isApprovalPopup = (page: Page, extensionId: string, match: string): boolean =>
  page.url().startsWith(`chrome-extension://${extensionId}`) &&
  page.url().includes(match) &&
  !page.isClosed();
```

`hasNotificationPopup` (`utils.ts:91-95`) wraps it over `context.pages()`.

- `packages/walletwright/src/internal/utils.test.ts` is the structural pattern (vitest `describe`/`it`,
  imports from `./utils.ts`). It currently covers `profileKey` and `extensionIdFromPath` only.
- These modules are NOT re-exported from `src/index.ts`, so exporting a helper from them does not
  change the package's public API.

## Commands you will need

| Purpose    | Command                                     | Expected on success       |
| ---------- | ------------------------------------------- | ------------------------- |
| Install    | `pnpm install`                              | exit 0                    |
| Unit tests | `pnpm turbo run test --filter=walletwright` | all pass, new tests added |
| Typecheck  | `pnpm typecheck`                            | exit 0                    |
| Lint       | `pnpm lint`                                 | exit 0                    |

## Scope

**In scope** (only files you should modify):

- `packages/walletwright/src/cli.ts` (export `parseFlags`; do NOT change its behavior in this plan)
- `packages/walletwright/src/internal/utils.ts` (export `isApprovalPopup`; no behavior change)
- `packages/walletwright/src/cli.test.ts` (create)
- `packages/walletwright/src/internal/utils.test.ts` (extend)

**Out of scope** (do NOT touch):

- The behavior of `parseFlags`, `main`, or `isApprovalPopup`. This plan only adds tests and the
  exports they need. Behavior hardening of the CLI is plan 018; keep it separate so the tests here
  first pin current behavior.
- `findNotificationPopup` (it needs a locator-bearing fake `Page`; heavier and out of scope here).

## Git workflow

- Branch: `improve-unit-test-pure-logic`.
- Conventional-commit message, e.g. `test(walletwright): cover parseFlags and isApprovalPopup`.
- Do NOT push or open a PR unless the operator asks.

## Steps

### Step 1: Export the two helpers

In `cli.ts`, add `parseFlags` to the module's exports (keep it otherwise unchanged). In `utils.ts`,
add `isApprovalPopup` to the exports. Match each file's existing export style.

**Verify**: `pnpm typecheck` exit 0.

### Step 2: Test `parseFlags`

Create `packages/walletwright/src/cli.test.ts`. Cover, at minimum:

- `["--wallet", "metamask"]` yields `{ wallet: "metamask" }`.
- A value-less trailing flag `["--headless"]` yields `{ headless: true }`.
- A flag followed by another flag `["--seed", "--password", "pw"]` yields `{ seed: true, password:
"pw" }` (documents the current boolean-coercion behavior that plan 018 will address).
- `-h` yields `{ h: true }`.
- `--flag=value` is NOT split (documents the unsupported form): `["--wallet=metamask"]` yields a key
  of `wallet=metamask`, not `{ wallet: "metamask" }`.

**Verify**: `pnpm turbo run test --filter=walletwright` all pass.

### Step 3: Test `isApprovalPopup`

Extend `utils.test.ts` with a minimal stub `Page` exposing `url()` and `isClosed()` (cast through
`unknown` to the Playwright `Page` type; do not import a real browser). Cover:

- Matching URL + token returns `true`.
- Wrong extension id returns `false`.
- Missing match token returns `false`.
- Closed page returns `false`.
- The Slush token: URL containing `isPopup=1` with `match: "isPopup=1"` returns `true`.

**Verify**: `pnpm turbo run test --filter=walletwright` all pass; `pnpm lint` exit 0.

## Test plan

- New file `cli.test.ts` (parser cases above) and new cases in `utils.test.ts` (predicate cases
  above). Structural pattern: `utils.test.ts`.
- A minimal fake for `Page`: `{ url: () => "chrome-extension://abc/notification.html", isClosed: () =>
false } as unknown as Page`.
- Verification: `pnpm turbo run test --filter=walletwright` all pass, including the new cases.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `parseFlags` is exported from `cli.ts`; `isApprovalPopup` is exported from `utils.ts`
- [ ] `cli.test.ts` exists and covers the five parser cases above
- [ ] `utils.test.ts` covers the five predicate cases above
- [ ] `pnpm turbo run test --filter=walletwright` exits 0
- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm lint` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report (do not improvise) if:

- `parseFlags` or `isApprovalPopup` no longer matches the "Current state" excerpt.
- Exporting either helper triggers a `fallow:dead` or lint error you cannot resolve without changing
  behavior.

## Maintenance notes

- Plan 018 changes CLI validation; when it lands, the boolean-coercion test from Step 2 should be
  updated to assert the new "reject value-less required flag" behavior. Note this in the 018 PR.
- If `findNotificationPopup`'s usable-button gate is ever changed, add a test for it then (it needs a
  locator-bearing fake, deferred out of this plan).
