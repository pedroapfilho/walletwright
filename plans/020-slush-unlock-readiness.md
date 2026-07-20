# Plan 020: Give Slush `reachUnlockScreen` a real readiness check (investigate-first)

> **Executor instructions**: INVESTIGATE-FIRST. This touches the timing-sensitive unlock path. Follow
> the steps, run every verification command, and honor STOP conditions: if you cannot verify against
> the real Slush extension, STOP and report. When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 993e798..HEAD -- packages/walletwright/src/wallets/slush.ts packages/walletwright/src/wallets/metamask/onboarding.ts packages/walletwright/src/wallets/phantom.ts`
> If any changed, compare the "Current state" excerpts against the live code; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (relates to plan 019; either order is fine)
- **Category**: tech-debt
- **Planned at**: commit `993e798`, 2026-07-20

## Why this matters

All three wallets' `reachUnlockScreen` open a page, navigate to the extension, and poll, but the
readiness strategies have diverged. MetaMask reloads until `input[type="password"]` is visible and
throws a clear "unlock screen never appeared" if it never is. Phantom polls the password element after
a single goto. Slush does neither: it retries the goto, then blind-sleeps 2500ms and returns,
regardless of whether the unlock UI is actually ready. So Slush can return a not-yet-ready page, and
the failure then surfaces downstream (at the first approval) instead of as a clear "unlock screen
never appeared". Reaching a usable unlock screen under a lazy MV3 worker is the library's flakiest
surface (AGENTS.md items 3, 10), so a divergent, weaker Slush implementation is a real reliability
gap.

## Current state

- `packages/walletwright/src/wallets/slush.ts:94-119`:

```ts
reachUnlockScreen: async (context: BrowserContext, extensionId) => {
  const page = await context.newPage();
  const url = `chrome-extension://${extensionId}/index.html`;
  for (let attempt = 0; attempt < 15; attempt++) {
    const ok = await page
      .goto(url, { waitUntil: "domcontentloaded" })
      .then(() => true)
      .catch(() => false);
    if (ok) {
      break;
    }
    await sleep(1000);
  }
  await sleep(2500); // blind sleep; no check that the unlock UI is ready
  return page;
},

unlock: async (page, password) => {
  // Slush typically reopens unlocked; only fill if it shows the password screen.
  const input = page.locator('input[type="password"]');
  if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
    await input.fill(password);
    await fclick(page, "Unlock");
    await sleep(1500);
  }
},
```

- `packages/walletwright/src/wallets/metamask/onboarding.ts:58-82`, the robust reference:

```ts
reachUnlockScreen: async (context, extensionId): Promise<Page> => {
  const page = await context.newPage();
  const password = page.locator('input[type="password"]');
  await page.goto(`chrome-extension://${extensionId}/home.html`);
  let ready = await password.waitFor({ state: "visible", timeout: 20_000 }).then(() => true).catch(() => false);
  for (let attempt = 0; attempt < 5 && !ready; attempt++) {
    await page.reload().catch(() => {});
    ready = await password.waitFor({ state: "visible", timeout: 5000 }).then(() => true).catch(() => false);
  }
  if (!ready) {
    throw new Error("[walletwright] MetaMask unlock screen never appeared");
  }
  return page;
},
```

- Key constraint for Slush: `unlock` legitimately no-ops when Slush reopens already unlocked. So Slush
  cannot simply throw when the password input is absent; "ready" means "either the password screen is
  visible OR the home route `#/tokens` is loaded". This is the crucial difference from MetaMask, whose
  cache is always locked on launch.

## Commands you will need

| Purpose      | Command                                     | Expected on success |
| ------------ | ------------------------------------------- | ------------------- |
| Install      | `pnpm install`                              | exit 0              |
| Unit tests   | `pnpm turbo run test --filter=walletwright` | all pass            |
| Typecheck    | `pnpm typecheck`                            | exit 0              |
| Lint         | `pnpm lint`                                 | exit 0              |
| E2E (headed) | `pnpm test:e2e`                             | Slush spec passes   |

`pnpm test:e2e` needs a headed display and the Slush cache built (see plan 019's note). If you cannot
run it, the Slush change is a STOP condition.

## Scope

**In scope** (only files you should modify):

- `packages/walletwright/src/wallets/slush.ts` (`reachUnlockScreen` readiness check)

**Out of scope** (do NOT touch):

- MetaMask and Phantom `reachUnlockScreen` (reference only; do not "unify" them in this plan, that is
  a larger refactor deferred, see Maintenance notes).
- Slush `unlock`, `approve`, `importWallet`.
- The `sleep()` durations elsewhere in Slush.

## Git workflow

- Branch: `improve-slush-unlock-readiness`.
- Conventional-commit message, e.g. `fix(slush): poll for a ready unlock screen instead of blind sleep`.
- Do NOT push or open a PR unless the operator asks.

## Steps

### Step 1: Replace the blind sleep with a readiness poll

After the goto-retry loop, poll (with the same patient budget the blind sleep implied, around a few
seconds) for EITHER the password input to be visible OR the home route `#/tokens` to be loaded. Return
as soon as either is true. If neither becomes true within the budget, throw `[walletwright] Slush
unlock screen never appeared`. Reuse the existing `page.evaluate(() => globalThis.location.hash)`
pattern already used in Slush's `importWallet` to read the route, and `page.locator('input[type=
"password"]').isVisible()` for the password check.

**Verify**: `pnpm typecheck` exit 0; `pnpm lint` exit 0; `pnpm turbo run test --filter=walletwright`
all pass.

### Step 2: Verify against the real extension

Build the Slush cache and run the Slush spec. A cold launch (locked) must reach the password screen;
a warm launch (already unlocked) must reach `#/tokens` without throwing.

**Verify**: `pnpm test:e2e` passes `apps/demo/tests/slush.spec.ts` across a couple of runs (MV3
flakiness; the config already sets `retries`).

## Test plan

- The change is browser-timing logic, so the real gate is the headed Slush E2E (Step 2). Do not add a
  headed spec to CI.
- If you can factor the "ready predicate" (password-visible OR route-is-home) into a small pure
  helper, add a unit test for the predicate; otherwise rely on E2E and say so in the PR.
- Verification: unit suite green; Slush headed spec green on cold and warm launches.

## Done criteria

- [ ] Slush `reachUnlockScreen` returns only once the password screen is visible or `#/tokens` is
      loaded, and throws a clear error otherwise (no bare `await sleep(2500); return page`)
- [ ] `pnpm typecheck` exits 0, `pnpm lint` exits 0
- [ ] `pnpm turbo run test --filter=walletwright` exits 0
- [ ] `pnpm test:e2e` passes the Slush spec (record the run)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report (do not improvise) if:

- You cannot run the headed Slush E2E (no display / cannot build the Slush cache; note that Slush's
  cache build is a known pre-existing fragility). Do not ship an unverified change to this path.
- A warm (already-unlocked) launch starts throwing (the readiness predicate is too strict, it must
  accept the home route as ready).
- Any excerpt no longer matches "Current state".

## Maintenance notes

- A broader refactor to unify all three `reachUnlockScreen` on a shared `gotoWithRetry` helper (see
  the tech-debt finding TECHDEBT-02) is deliberately deferred; this plan only closes Slush's
  readiness gap. If that refactor is taken later, keep each wallet's readiness predicate distinct
  (MetaMask always-locked vs Slush maybe-unlocked).
- A reviewer should confirm the warm-launch path (home route) is accepted as ready.
