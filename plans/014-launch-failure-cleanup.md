# Plan 014: Close the context and temp profile when `launchWalletContext` fails after launch

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If anything in "STOP conditions" occurs, stop and
> report. When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 993e798..HEAD -- packages/walletwright/src/internal/launch.ts packages/walletwright/src/internal/cache.ts`
> If either file changed since this plan was written, compare the "Current state" excerpts against the
> live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `993e798`, 2026-07-20

## Why this matters

`launchWalletContext` creates a persistent Chromium context, then runs `reachUnlockScreen`, `unlock`,
and `closeStrayPages` with no surrounding try/catch. Those steps throw by design when the wallet does
not reach a usable unlock screen (MV3 service-worker flakiness is documented in AGENTS.md item 10).
When they throw, the context is never closed, and the throwaway profile copy (created with `mkdtemp`
plus `cp`) is never removed, because its cleanup is bound to the context's `close` event, which never
fires. Under Playwright fixtures the teardown after `use` also never runs when setup throws. A flaky
suite with `retries` set therefore leaks one live browser process plus one profile copy per failed
attempt. The sibling `buildCache` already handles this correctly, so the fix is to mirror its pattern.

## Current state

- `packages/walletwright/src/internal/launch.ts:64-88`, the unprotected sequence:

```ts
const runDir = await mkdtemp(path.join(os.tmpdir(), "walletwright-"));
await cp(profileDir, runDir, { recursive: true });

const context = await chromium.launchPersistentContext(runDir, {
  args: launchArgs(extensionPath),
  headless: false,
});

// Cleanup is bound to the close event, which never fires if the steps below throw.
context.on("close", async () => {
  await rm(runDir, { force: true, recursive: true }).catch(() => {});
});

const extensionId = extensionIdFromPath(extensionPath);

const home = await definition.reachUnlockScreen(context, extensionId); // can throw
await definition.unlock(home, setup.password); // can throw
await closeStrayPages(context, home); // can throw

return {
  context,
  wallet: createWallet({ context, definition, extensionId, home, password: setup.password }),
};
```

- `packages/walletwright/src/internal/cache.ts:38-75`, the exemplar to follow:

```ts
const context = await chromium.launchPersistentContext(profileDir, { args, headless: false });
try {
  // ... navigate, import, close ...
  return profileDir;
} catch (error) {
  await context.close().catch(() => {});
  throw error;
}
```

- Closing the context fires the `context.on("close", ...)` handler in `launch.ts:74-76`, which
  already removes `runDir`. So `await context.close()` in a catch also cleans the temp profile.

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

- `packages/walletwright/src/internal/launch.ts`

**Out of scope** (do NOT touch):

- `packages/walletwright/src/internal/cache.ts` (already correct; reference only).
- `packages/walletwright/src/internal/controller.ts` and `fixtures.ts` (the leak is in `launch.ts`;
  do not change fixture teardown).

## Git workflow

- Branch: `improve-launch-failure-cleanup`.
- Conventional-commit message, e.g. `fix(launch): close context and temp profile on unlock failure`.
- Do NOT push or open a PR unless the operator asks.

## Steps

### Step 1: Wrap the post-launch steps in try/catch

Wrap everything from `const extensionId = extensionIdFromPath(...)` through the `return { context,
wallet: ... }` in a `try`. In the `catch`, close the context (which triggers the existing `runDir`
cleanup handler) and rethrow. Target shape:

```ts
const extensionId = extensionIdFromPath(extensionPath);
try {
  const home = await definition.reachUnlockScreen(context, extensionId);
  await definition.unlock(home, setup.password);
  await closeStrayPages(context, home);
  return {
    context,
    wallet: createWallet({ context, definition, extensionId, home, password: setup.password }),
  };
} catch (error) {
  await context.close().catch(() => {});
  throw error;
}
```

Leave the `context.on("close", ...)` handler in place: on success it still cleans `runDir` when the
caller later closes the context; on failure the catch's `context.close()` fires it.

**Verify**: `pnpm typecheck` exit 0; `pnpm lint` exit 0.

### Step 2: Confirm nothing else regressed

**Verify**: `pnpm turbo run test --filter=walletwright` all pass; `pnpm --filter walletwright build`
exit 0.

## Test plan

- `launchWalletContext` launches a real browser, so a full unit test is not practical without one. Do
  NOT add a test that spawns Chromium to the unit suite (it would break the headless CI gate).
- If you can extract the cleanup into a small pure helper testable without a browser, add
  `launch.test.ts` covering "cleanup runs when the wrapped step throws" (structural pattern:
  `packages/walletwright/src/internal/utils.test.ts`). If that refactor would enlarge the change or
  risk the launch path, skip it and note in the PR that verification is by review plus the existing
  suite.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `launch.ts` wraps `reachUnlockScreen`/`unlock`/`closeStrayPages`/`createWallet` in a try/catch
      that calls `context.close()` on error and rethrows
- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm turbo run test --filter=walletwright` exits 0
- [ ] `pnpm --filter walletwright build` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report (do not improvise) if:

- `launch.ts` no longer matches the "Current state" excerpt.
- The only way to verify requires spawning a browser in the unit suite (do not; report that
  verification is by review).

## Maintenance notes

- A reviewer should confirm the catch rethrows (does not swallow) and the success path still returns
  the live context.
- If `launchWalletContext` later gains steps between context creation and the try block, ensure they
  cannot throw without cleanup, or move them inside the try.
