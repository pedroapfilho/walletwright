# Plan 003: Make `installMockWallet` safe to call more than once per context

> **Executor instructions**: Follow step by step; verify each step. STOP conditions halt you. Update
> `plans/README.md` when done unless a reviewer maintains it.
>
> **Drift check (run first)**: `git diff --stat 0f0db25..HEAD -- packages/walletwright/src/mock.ts`
> On any change, compare against "Current state"; mismatch means STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `0f0db25`, 2026-07-16

## Why this matters

`installMockWallet` calls `target.exposeFunction("__walletwrightMockRpc", ...)`. Playwright throws
`Function "__walletwrightMockRpc" has been already registered` if that name is exposed twice on the
same context (or on a context and then a page in that context). A natural usage, installing the mock
in a `beforeEach` on a shared context, or on both the context and a specific page, crashes on the
second call with an error that does not name the real cause. The fix makes a repeat install a no-op
(or a clean re-install) instead of a crash.

## Current state

- `packages/walletwright/src/mock.ts` is the headless mock wallet. The relevant lines:

Excerpt (`mock.ts:63-64`):

```ts
  const bindingName = "__walletwrightMockRpc";
  await target.exposeFunction(bindingName, (rpc: Rpc) => handle(rpc));
```

`target` is typed `BrowserContext | Page` (`mock.ts:29-32`). Both expose `exposeFunction`. Playwright
has no "is this function already exposed" query, so the guard must catch the specific error.

Repo conventions: arrow functions, `.ts` extensions, comments only for a non-obvious WHY, no long
dash (U+2014). The file already uses `try/catch` nowhere; keep the addition minimal and typed (no
`any`; use `unknown` in catch and narrow, or check `error instanceof Error`).

## Commands you will need

| Purpose   | Command (from repo root)               | Expected on success |
|-----------|----------------------------------------|---------------------|
| Typecheck | `pnpm --filter walletwright typecheck` | exit 0, no errors   |
| Lint      | `pnpm --filter walletwright lint`      | 0 warnings 0 errors |
| Build     | `pnpm --filter walletwright build`     | "Build complete"    |
| Mock spec | `pnpm --filter demo exec playwright test tests/mock.spec.ts` | 1 passed (see note) |

Note on the mock spec: it needs the demo dev server, which the Playwright config starts automatically
(`webServer` in `apps/demo/playwright.config.ts`). It does NOT need a wallet extension or a local
chain, so it runs in plain Chromium. If it fails to start the web server in the executor's fresh
worktree, run `pnpm --filter walletwright build` first (the demo imports the built `walletwright`
package), then retry. If it still cannot run, note that in your report and rely on typecheck + lint +
build for this plan; do not treat an environment failure as a plan failure.

## Scope

**In scope**:
- `packages/walletwright/src/mock.ts`

**Out of scope**:
- `apps/demo/tests/mock.spec.ts` (you may run it, do not edit it).
- The `handle` RPC logic, the EIP-6963 announce, the exported types.

## Git workflow

- Commit: `fix(walletwright): make installMockWallet idempotent per context`.
- Do NOT push or open a PR.

## Steps

### Step 1: Guard the double-registration

Wrap the `exposeFunction` call so that a repeat registration is tolerated. Playwright throws an
`Error` whose message contains `already registered`. Catch exactly that and treat it as "the RPC
bridge is already installed", rethrow anything else.

Target shape:

```ts
  const bindingName = "__walletwrightMockRpc";
  try {
    await target.exposeFunction(bindingName, (rpc: Rpc) => handle(rpc));
  } catch (error) {
    // Playwright rejects a second exposeFunction with the same name; the bridge is already there,
    // so a repeat install (e.g. in a per-test hook) is fine. Any other error is real.
    if (!(error instanceof Error && error.message.includes("already registered"))) {
      throw error;
    }
  }
```

The `addInitScript` call below it is naturally idempotent enough for a repeat install (it re-adds the
init script; the provider object is simply re-created on the next navigation), so leave it as is.

**Verify**: `pnpm --filter walletwright typecheck` → exit 0.

### Step 2: Lint, build, and (if the environment allows) the mock spec

**Verify**: `pnpm --filter walletwright lint` → 0 warnings 0 errors; `pnpm --filter walletwright build`
→ "Build complete". Then attempt `pnpm --filter demo exec playwright test tests/mock.spec.ts` from
repo root and record the result (see the environment note above).

## Test plan

The existing `apps/demo/tests/mock.spec.ts` (out of scope) proves the mock still connects and signs.
Optionally confirm the new guard by reasoning, not a new test: a second `installMockWallet` on the
same context must no longer reject. Do NOT add a new spec in this plan.

## Done criteria

ALL must hold:

- [ ] `pnpm --filter walletwright typecheck` exits 0
- [ ] `pnpm --filter walletwright lint` reports 0 warnings, 0 errors
- [ ] `pnpm --filter walletwright build` prints "Build complete"
- [ ] `mock.ts` wraps `exposeFunction` in a `try/catch` that rethrows anything except an
      `already registered` error (no `any`, no bare `catch {}`)
- [ ] `git status` shows only `packages/walletwright/src/mock.ts` modified
- [ ] `plans/README.md` row for 003 updated (unless the reviewer maintains it)

## STOP conditions

Stop and report if:

- The `mock.ts` excerpt does not match the live code (drift).
- Lint rejects `error instanceof Error && error.message.includes(...)` for a stylistic rule you
  cannot satisfy without changing behavior; report the rule rather than weakening the guard to a
  bare `catch {}`.

## Maintenance notes

- If the mock later needs a per-install unique binding name (e.g. multiple distinct mock wallets on
  one page for EIP-6963 multi-wallet tests), this guard should be replaced by a per-instance name
  rather than a swallow.
- Reviewer: confirm non-`already registered` errors still propagate (the guard must not become a
  blanket `catch {}`).
