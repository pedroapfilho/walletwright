# Plan 019: Make failed approvals and unlocks fail loudly (investigate-first)

> **Executor instructions**: This is an INVESTIGATE-FIRST plan. It touches the timing-sensitive
> wallet-driving path AGENTS.md warns against "simplifying". Follow the steps, run every verification
> command, and honor the STOP conditions strictly: if you cannot verify a change against a real
> extension, STOP and report rather than guessing. When done, update this plan's row in
> `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 993e798..HEAD -- packages/walletwright/src/wallets/slush.ts packages/walletwright/src/internal/controller.ts packages/walletwright/src/wallets/metamask/onboarding.ts`
> If any changed, compare the "Current state" excerpts against the live code; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `993e798`, 2026-07-20

## Why this matters

Three spots swallow an approval/unlock failure, so a real failure surfaces later as a confusing
far-away timeout instead of at the boundary where it happened:

1. Slush `approve` returns silently when neither confirm button is found, and its `fclick` returns
   `true` on mere visibility even if the click was swallowed.
2. `resolvePopup` waits up to 15s for the popup to close but never throws if it stays open, so a no-op
   approval reports success.
3. MetaMask `unlock` swallows the "password field never went hidden" timeout, so a failed unlock
   proceeds as if unlocked.

The value is faster, clearer diagnosis. The risk is that Slush's UI is animated and its handlers wire
up late (AGENTS.md notes early clicks are silent no-ops), so tightening naively can turn a
recoverable lag into a false failure. Hence investigate-first: tune against the real extension.

## Current state

- `packages/walletwright/src/wallets/slush.ts:14-42`:

```ts
const fclick = async (page: Page, text: string, timeoutMs = 8000): Promise<boolean> => {
  const target = page.getByText(text, { exact: true }).first();
  if (!(await target.isVisible({ timeout: timeoutMs }).catch(() => false))) {
    return false;
  }
  await target.scrollIntoViewIfNeeded().catch(() => {});
  await target.click({ force: true, timeout: timeoutMs }).catch(() => {}); // swallows click failure
  return true; // true means "was visible", not "click landed"
};

approve: async (popup, password) => {
  await sleep(2000);
  const confirmed = (await fclick(popup, "Approve")) || (await fclick(popup, "Sign"));
  if (!confirmed) {
    return; // silent no-op
  }
  await sleep(1500);
  const input = popup.locator('input[type="password"]');
  if (await input.isVisible({ timeout: 4000 }).catch(() => false)) {
    await input.fill(password);
    await fclick(popup, "Unlock");
  }
},
```

- `packages/walletwright/src/internal/controller.ts:61-65`:

```ts
// Wait for the popup to close so the next approval doesn't grab a stale page.
const deadline = Date.now() + 15_000;
while (hasNotificationPopup(context, extensionId, match) && Date.now() < deadline) {
  await sleep(200);
}
// returns even if the popup never closed
```

- `packages/walletwright/src/wallets/metamask/onboarding.ts:4-12`:

```ts
export const unlock = async (page: Page, password: string): Promise<void> => {
  const input = page.locator('input[type="password"]');
  await input.fill(password);
  await input.press("Enter");
  await page
    .locator('input[type="password"]')
    .waitFor({ state: "hidden", timeout: 15_000 })
    .catch(() => {}); // swallows the "still visible" failure
};
```

Unlike Phantom/Slush (which may legitimately already be unlocked), MetaMask's `reachUnlockScreen`
guarantees the password screen is present, so its persistence after `unlock` is a genuine failure.

## Commands you will need

| Purpose      | Command                                     | Expected on success |
| ------------ | ------------------------------------------- | ------------------- |
| Install      | `pnpm install`                              | exit 0              |
| Unit tests   | `pnpm turbo run test --filter=walletwright` | all pass            |
| Typecheck    | `pnpm typecheck`                            | exit 0              |
| Lint         | `pnpm lint`                                 | exit 0              |
| E2E (headed) | `pnpm test:e2e`                             | all specs pass      |

Note: `pnpm test:e2e` needs a headed display and the wallet cache built (`cd apps/demo` then
`pnpm exec playwright install chromium`, `pnpm test:cache`). The network/transaction specs also need
a local anvil on `127.0.0.1:8545`. If you cannot run the headed E2E, that is a STOP condition for the
Slush and MetaMask changes (see STOP conditions).

## Scope

**In scope** (only files you should modify):

- `packages/walletwright/src/internal/controller.ts` (make `resolvePopup` throw on a stuck required
  popup)
- `packages/walletwright/src/wallets/slush.ts` (throw when no confirm button is actionable)
- `packages/walletwright/src/wallets/metamask/onboarding.ts` (throw when unlock did not take)

**Out of scope** (do NOT touch):

- Phantom's `unlock` (it may legitimately be already unlocked; different contract).
- The `optional: true` path in `resolvePopup` (a missing popup there is a normal outcome, e.g.
  Phantom auto-approve); only the required path should get stricter.
- The `sleep()` durations defended in AGENTS.md; do not remove them.

## Git workflow

- Branch: `improve-loud-approval-failures`.
- Conventional-commit message, e.g. `fix(controller,slush,metamask): fail loudly on stuck approval/unlock`.
- Do NOT push or open a PR unless the operator asks.

## Steps

### Step 1: Make the required-popup path throw when the popup never closes

In `resolvePopup`, after the close-wait loop, if `optional` is false and `hasNotificationPopup(...)`
is still true, throw `[walletwright] approval popup did not close after 15s (approval may not have
registered)`. Leave the optional path unchanged.

**Verify**: `pnpm typecheck` exit 0; `pnpm lint` exit 0; `pnpm turbo run test --filter=walletwright`
all pass (adjust `controller.test.ts` only if it asserts the old no-throw behavior).

### Step 2: Make Slush `approve` report a real failure

Change `fclick` to distinguish "not visible" from "click failed" (do not swallow the click error for
the confirm buttons), and have `approve` throw when neither "Approve" nor "Sign" was actionable
instead of returning silently. Keep the 2000ms settle sleep and the force-click (both load-bearing).
This must be tuned against the real Slush popup, its handlers wire up late; verify a genuine connect
and sign still pass before tightening the timeout.

**Verify**: `pnpm test:e2e` (the Slush spec `apps/demo/tests/slush.spec.ts`) still passes connect and
sign. If it does not, revert the tightening and STOP.

### Step 3: Make MetaMask `unlock` throw when the password field stays visible

Replace the swallowing `.catch(() => {})` with a check that, after the (possibly retried) wait, throws
`[walletwright] MetaMask unlock failed (password screen still visible)` when the input is still
visible. Pair with a short retry/longer wait first so MV3 lag does not cause a false failure.

**Verify**: `pnpm test:e2e` (the MetaMask specs) still pass unlock+connect+sign across retries.

## Test plan

- Unit: `controller.test.ts` can cover the new `resolvePopup` throw with the existing stub-definition
  pattern plus a fake `hasNotificationPopup` that stays true (if the test seam allows; if not, note
  it and rely on E2E).
- E2E: the existing `apps/demo/tests/{slush,metamask,metamask-solana}.spec.ts` are the real gate for
  Steps 2 and 3. They must still pass; the improvement is that an injected failure now throws at the
  approval/unlock boundary. Do not add new headed specs to CI.
- Verification: unit suite green, and headed E2E green for the affected wallets.

## Done criteria

Machine-checkable where possible. ALL must hold:

- [ ] `resolvePopup` throws on a stuck required popup (optional path unchanged)
- [ ] Slush `approve` throws when no confirm button is actionable (no silent `return`)
- [ ] MetaMask `unlock` throws when the password screen persists after the retried wait
- [ ] `pnpm typecheck` exits 0, `pnpm lint` exits 0
- [ ] `pnpm turbo run test --filter=walletwright` exits 0
- [ ] `pnpm test:e2e` passes the MetaMask, MetaMask-Solana, and Slush specs (record the run)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report (do not improvise) if:

- You cannot run the headed E2E (no display / cannot build the cache). The `controller.ts`
  (`resolvePopup`) change is unit-verifiable and may proceed, but the Slush and MetaMask changes MUST
  be E2E-verified; do not ship them unverified.
- Tightening Slush or MetaMask makes a genuine connect/sign/unlock fail (the lag was recoverable):
  revert that change and report.
- Any excerpt no longer matches "Current state".

## Maintenance notes

- These are the flakiest surfaces in the library. A reviewer should confirm each new throw fires only
  after the documented settle/retry waits, not before.
- If Slush's popup markup changes, `fclick`'s visible/actionable distinction may need retuning.
