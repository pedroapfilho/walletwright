# Plan 001: Remove the throwaway profile directory when the wallet context closes

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before the next step. If a STOP condition occurs, stop and report.
> When done, update the status row in `plans/README.md` unless a reviewer told you they maintain it.
>
> **Drift check (run first)**: `git diff --stat 0f0db25..HEAD -- packages/walletwright/src/internal/launch.ts`
> If `launch.ts` changed since this plan was written, compare the "Current state" excerpt against the
> live code first; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `0f0db25`, 2026-07-16

## Why this matters

Every call to `launchWalletContext` makes a fresh `mkdtemp` directory under the OS temp dir and
recursively copies the entire onboarded extension profile into it (a full MetaMask or Phantom
profile is tens of MB). Nothing ever deletes that directory; `context.close()` leaves it on disk. A
real Playwright run is (workers x specs x retries) launches, so a suite leaks hundreds of profile
copies and can fill the temp partition over a CI day. The fix registers a cleanup that fires when the
context closes.

## Current state

- `packages/walletwright/src/internal/launch.ts` is the launcher. It creates `runDir` via `mkdtemp`,
  copies the cached profile into it, launches a persistent context from it, and returns the context.
  The temp dir is never removed.

Excerpt (`launch.ts:62-83`):

```ts
// Run from a throwaway copy so the cache stays pristine and parallel runs don't share a profile.
const runDir = await mkdtemp(path.join(os.tmpdir(), "walletwright-"));
await cp(profileDir, runDir, { recursive: true });

const context = await chromium.launchPersistentContext(runDir, {
  args: launchArgs(extensionPath),
  headless: false,
});

const extensionId = extensionIdFromPath(extensionPath);

// Kept open (not closed after unlock): the settings/network/account actions drive this page.
const home = await definition.reachUnlockScreen(context, extensionId);
await definition.unlock(home, setup.password);
await closeStrayPages(context, home);

return {
  context,
  wallet: createWallet({ context, definition, extensionId, home, password: setup.password }),
};
```

Existing imports at the top (`launch.ts:1-12`):

```ts
import { existsSync } from "node:fs";
import { cp, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { type BrowserContext, chromium, type Page } from "@playwright/test";

import type { Wallet, WalletSetup } from "../types.ts";
import { wallets } from "../wallets/index.ts";

import { createWallet } from "./controller.ts";
import { DEFAULT_CACHE_DIR, extensionIdFromPath, profileKey } from "./utils.ts";
```

Repo conventions: TypeScript ESM with `.ts` import extensions, arrow functions, `const` over `let`.
Comments state only a non-obvious WHY (see `AGENTS.md`). Never use a long dash (U+2014) anywhere in
code, comments, or commits; use a period, comma, semicolon, or parentheses. `rm` is imported from
`node:fs/promises` in the sibling file `internal/download.ts`, use that as the API reference.

## Commands you will need

| Purpose   | Command (from repo root)               | Expected on success |
| --------- | -------------------------------------- | ------------------- |
| Install   | `pnpm install`                         | exit 0              |
| Typecheck | `pnpm --filter walletwright typecheck` | exit 0, no errors   |
| Lint      | `pnpm --filter walletwright lint`      | 0 warnings 0 errors |
| Build     | `pnpm --filter walletwright build`     | "Build complete"    |
| Unit test | `pnpm --filter walletwright test`      | all pass            |

## Scope

**In scope** (only file to modify):

- `packages/walletwright/src/internal/launch.ts`

**Out of scope** (do NOT touch):

- `internal/cache.ts` and `buildCache`; the persistent cache is intentionally kept.
- `closeStrayPages`; unrelated tab cleanup.
- The `{ context, wallet }` return shape; callers depend on it.

## Git workflow

- Commit on the branch you were dispatched on, conventional-commit style, e.g.
  `fix(walletwright): remove throwaway profile dir when the context closes`.
- Do NOT push or open a PR.

## Steps

### Step 1: Remove the temp profile dir on context close

Add `rm` to the existing `node:fs/promises` import. After the context is created, register a one-shot
cleanup on the context `close` event that removes `runDir`. The handler swallows its own errors (the
dir may already be gone) and is fire-and-forget (never awaited).

Target shape:

```ts
import { cp, mkdtemp, rm } from "node:fs/promises";
// ...
const context = await chromium.launchPersistentContext(runDir, {
  args: launchArgs(extensionPath),
  headless: false,
});

// The throwaway profile copy is only needed while the context is live; drop it on close so a long
// suite (workers x specs x retries) doesn't fill the temp dir with profile copies.
context.on("close", () => {
  void rm(runDir, { force: true, recursive: true }).catch(() => {});
});
```

**Verify**: `pnpm --filter walletwright typecheck` → exit 0, no errors.

### Step 2: Confirm lint and build

**Verify**: `pnpm --filter walletwright lint` → 0 warnings 0 errors; then
`pnpm --filter walletwright build` → prints "Build complete".

## Test plan

No new unit test: this needs a launched browser context, which the CI-runnable vitest suite does not
have (only `src/wallets/registry.test.ts` runs there, browser-free). Verification is typecheck + lint

- build plus reviewer confirmation that the close handler removes `runDir`. Do NOT add a
  browser-driving test; that belongs to the headed demo specs, which are out of scope.

## Done criteria

ALL must hold:

- [ ] `pnpm --filter walletwright typecheck` exits 0
- [ ] `pnpm --filter walletwright lint` reports 0 warnings, 0 errors
- [ ] `pnpm --filter walletwright build` prints "Build complete"
- [ ] `launch.ts` imports `rm` and registers a `context.on("close", ...)` handler calling
      `rm(runDir, { force: true, recursive: true })`
- [ ] `git status` shows only `packages/walletwright/src/internal/launch.ts` modified
- [ ] `plans/README.md` status row for 001 updated (unless your reviewer maintains it)

## STOP conditions

Stop and report (do not improvise) if:

- The `launch.ts` excerpt does not match the live code (drift).
- `context.on` is not a function on the returned context; report the type error rather than casting.
- Lint flags the empty `.catch(() => {})` as an error; report it so the reviewer picks the
  convention rather than you inventing one.

## Maintenance notes

- If the launcher ever stops copy-to-temp (launches the cache in place), this cleanup becomes dead
  and should be removed with that change.
- Reviewer: confirm the handler does not `await`, and that it targets `runDir`, not `profileDir`
  (deleting `profileDir` would destroy the persistent cache).
