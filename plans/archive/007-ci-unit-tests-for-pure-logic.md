# Plan 007: Add CI-runnable unit tests for the engine's pure logic

> **Executor instructions**: Follow step by step; verify each step. STOP conditions halt you. Update
> `plans/README.md` when done unless a reviewer maintains it.
>
> **Drift check (run first)**:
> `git diff --stat 0f0db25..HEAD -- packages/walletwright/src/internal/utils.ts packages/walletwright/src/internal/controller.ts`
> On any change, compare against "Current state"; mismatch means STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `0f0db25`, 2026-07-16

## Why this matters

The only test that runs in CI is `src/wallets/registry.test.ts`. Everything else, including the pure
browser-free logic (`profileKey`, `extensionIdFromPath`, and the controller's capability dispatch and
unsupported-action error path), is exercised only by the headed demo specs, which need a real
extension and do NOT run in CI. A regression in that logic therefore ships green. This plan adds fast
vitest unit tests for the parts that need no browser, so CI actually guards them.

## Current state

- `packages/walletwright/src/internal/utils.ts` exports `profileKey(setup)` and
  `extensionIdFromPath(extensionPath)`, both pure and browser-free:

```ts
export const profileKey = (setup: WalletSetup): string =>
  createHash("sha256")
    .update(`${setup.wallet}:${setup.version ?? "default"}:${setup.seedPhrase}:${setup.password}`)
    .digest("hex")
    .slice(0, 20);
```

`extensionIdFromPath` for a path with no `manifest.json` on disk returns a 32-character string whose
characters are all in the range `a` to `p` (it maps each hex nibble `0..f` to `a..p`). It is
deterministic for a given absolute path and differs for different paths.

- `packages/walletwright/src/internal/controller.ts` exports
  `createWallet({ context, definition, extensionId, home, password })`. Its `action` helper throws
  `[walletwright] <extensionName> does not support <name>()` when the definition does not declare a
  capability, and otherwise invokes the declared function then re-fronts the dapp via
  `context.pages()`:

```ts
const action =
  (fn, name) =>
  async (...args) => {
    if (!fn) throw unsupported(name);
    await fn(ctx, ...args);
    const dapp = context.pages().find((page) => /^https?:/v.test(page.url()) && !page.isClosed());
    await dapp?.bringToFront().catch(() => {});
  };
```

Testability fact: the unsupported-action throw happens before any page interaction, and a declared
action's dapp re-front is a no-op when `context.pages()` returns `[]`. So `createWallet` can be
unit-tested with stub `context`/`home` objects (cast to the Playwright types) and never launch a
browser.

Test-style reference: `packages/walletwright/src/wallets/registry.test.ts` (vitest
`describe`/`it`/`expect`, `.ts` imports). Vitest config comes from `@repo/config-vitest`; tests are
`*.test.ts` next to the source. `vi.fn()` is available from `vitest` for spies.

Repo conventions: arrow functions, `.ts` extensions, `type` over `interface`, no long dash (U+2014).
No `as any`; when stubbing Playwright types, cast through `as unknown as BrowserContext` or `as Page`.

## Commands you will need

| Purpose   | Command (from repo root)               | Expected on success  |
| --------- | -------------------------------------- | -------------------- |
| Typecheck | `pnpm --filter walletwright typecheck` | exit 0, no errors    |
| Lint      | `pnpm --filter walletwright lint`      | 0 warnings 0 errors  |
| Unit test | `pnpm --filter walletwright test`      | all pass (incl. new) |
| Build     | `pnpm --filter walletwright build`     | "Build complete"     |

## Scope

**In scope** (create these test files only):

- `packages/walletwright/src/internal/utils.test.ts`
- `packages/walletwright/src/internal/controller.test.ts`

**Out of scope**:

- Any source file under `src/`. This plan adds tests only; do NOT modify `utils.ts`,
  `controller.ts`, or types to make them "more testable"; they are already testable as shown.
- `download.test.ts` (owned by plans 005/006).

## Git workflow

- Commit: `test(walletwright): unit-test profileKey, extensionIdFromPath, and capability dispatch`.
- Do NOT push or open a PR.

## Steps

### Step 1: `utils.test.ts`

Test `profileKey`:

- returns a 20-character lowercase hex string for a sample `WalletSetup`.
- is deterministic (same input gives same output).
- changes when any of `wallet`, `version`, `seedPhrase`, `password` changes.

Test `extensionIdFromPath`:

- for an absolute path that does not exist on disk, returns a string matching `/^[a-p]{32}$/`.
- is deterministic for the same path and differs for a different path.

Build sample `WalletSetup` objects inline (use the public test mnemonic
`"test test test test test test test test test test test junk"` and any placeholder password; these
are public test values, not secrets). Use a clearly-fake absolute path such as
`/tmp/walletwright-does-not-exist-xyz`.

**Verify**: `pnpm --filter walletwright test` runs the new utils tests and they pass.

### Step 2: `controller.test.ts`

Import `createWallet` from `./controller.ts`. Construct a minimal fake `WalletDefinition` (cast via
`as unknown as WalletDefinition`) providing only what the tested paths touch: `extensionName`,
`approve` (a `vi.fn()`), and an `actions` object varied per test. Provide a stub context
`{ pages: () => [] } as unknown as BrowserContext` and a stub home `{} as unknown as Page`.

Cases:

- Calling a capability the definition does NOT declare rejects with a message containing
  `does not support settings.lock` (definition whose `actions` omits `settings`).
- Calling a declared capability invokes its function: set `actions.network.add = vi.fn()`, call
  `wallet.network.add({...})`, assert the spy was called once and its first argument is the action
  context.
- `wallet.extensionId` equals the `extensionId` passed in and `wallet.home` is the stub home.

**Verify**: `pnpm --filter walletwright test` runs the new controller tests and they pass.

### Step 3: Full gate

**Verify**: `pnpm --filter walletwright typecheck` exits 0; `pnpm --filter walletwright lint` reports
0 warnings 0 errors; `pnpm --filter walletwright build` prints "Build complete".

## Test plan

The two new files ARE the deliverable. They must assert real behavior, not just "it runs": the
`extensionIdFromPath` charset assertion, the `profileKey` input-sensitivity assertions, and the
controller throw-message assertion each catch a concrete regression class. A reviewer will read the
assertions; a test that only checks "returns a string" does not count.

## Done criteria

ALL must hold:

- [ ] `pnpm --filter walletwright test` passes and now includes `utils.test.ts` and
      `controller.test.ts`
- [ ] `utils.test.ts` asserts `profileKey` is 20 hex chars, deterministic, and input-sensitive; and
      `extensionIdFromPath` matches `/^[a-p]{32}$/`, is deterministic, and path-sensitive
- [ ] `controller.test.ts` asserts the unsupported-action throw message and that a declared action's
      function is invoked
- [ ] `pnpm --filter walletwright typecheck` exits 0; no `as any` used (only `as unknown as T`)
- [ ] `pnpm --filter walletwright lint` reports 0 warnings, 0 errors
- [ ] `git status` shows only the two new test files added (no `src/` source file modified)
- [ ] `plans/README.md` row for 007 updated (unless the reviewer maintains it)

## STOP conditions

Stop and report if:

- The `utils.ts` or `controller.ts` excerpts do not match the live code (drift).
- `createWallet` cannot be constructed with stub context/home without launching a browser (the
  constructor eagerly touches the page): report what it touches rather than adding a browser.
- Lint forbids the `as unknown as T` casts under a rule you cannot satisfy; report the rule rather
  than switching to `as any`.

## Maintenance notes

- When a new capability group is added, extend `controller.test.ts` with an unsupported-throw case
  for it (plan 008 adds a drift guard that helps here).
- Reviewer: read the assertions, not just the pass count; confirm the controller test exercises both
  the throw and the invoke branches.
