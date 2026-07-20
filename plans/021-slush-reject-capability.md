# Plan 021: Add `reject` to Slush (finish the reject story)

> **Executor instructions**: SPIKE + IMPLEMENT. `reject` must be driven against the real Slush
> extension before it is declared (the repo's rule: a capability is declared only once verified end
> to end). Follow the steps, honor STOP conditions, update this plan's row in `plans/README.md` when
> done.
>
> **Drift check (run first)**: `git diff --stat 993e798..HEAD -- packages/walletwright/src/wallets/slush.ts packages/walletwright/src/wallets/phantom.ts packages/walletwright/src/types.ts`
> On a mismatch with the excerpts below, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M (empirical: driving the real popup is the unknown)
- **Risk**: LOW (additive capability)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `993e798`, 2026-07-20

## Why this matters

`reject` is optional on `WalletDefinition` (`types.ts:117`) but every `Wallet` exposes
`reject`/`rejectConnection`/`rejectSignature`/`rejectTransaction` (`types.ts:161-168`). MetaMask and
Phantom implement it; Slush does not, so calling `wallet.reject()` on Slush throws `[walletwright]
Slush does not support reject()`, and the "Rejecting a request" recipe in `examples.mdx` only works on
two of the three shipped wallets. Rejection is exactly what a dapp's unhappy-path tests exercise.
Closing the asymmetry makes the API uniform across all shipped wallets, which is the library's core
promise (one API, never branch per chain).

## Current state

- `packages/walletwright/src/wallets/phantom.ts:87-89`, the reference implementation:

```ts
reject: async (popup) => {
  await popup.getByTestId("secondary-button").click({ timeout: 15_000 });
},
```

- `packages/walletwright/src/wallets/slush.ts:25-42` declares `approve` but NO `reject`. Slush's
  buttons are non-native and need `click({ force: true })`; its handlers wire up ~2s late (the
  `approve` path sleeps 2000ms first). The confirm text is "Approve"/"Sign"; the cancel control's
  label/testid is UNKNOWN and must be discovered empirically.
- `packages/walletwright/src/types.ts:113-117` documents `reject` as optional, declared only once
  driven against the real extension.
- Docs to update once shipped: `apps/docs/content/docs/api-reference.mdx:136-138` ("Today `reject` is
  verified on MetaMask and Phantom ...").

## Commands you will need

| Purpose      | Command          | Expected on success |
| ------------ | ---------------- | ------------------- |
| Install      | `pnpm install`   | exit 0              |
| Typecheck    | `pnpm typecheck` | exit 0              |
| Lint         | `pnpm lint`      | exit 0              |
| E2E (headed) | `pnpm test:e2e`  | Slush specs pass    |

Headed E2E needs a display and the Slush cache (see plan 019's note). This plan CANNOT be completed
without it (the reject control must be observed and verified live).

## Scope

**In scope**:

- `packages/walletwright/src/wallets/slush.ts` (add `reject`)
- `apps/demo/tests/slush.spec.ts` (add a reject case) and any demo dapp affordance needed to trigger a
  rejectable request (mirror how MetaMask/Phantom reject cases are structured, if present)
- `apps/docs/content/docs/api-reference.mdx` (move Slush into the "reject verified" list)

**Out of scope**:

- MetaMask/Phantom reject. Slush `approve`/`unlock`/`importWallet`.
- Declaring any OTHER optional capability for Slush (accounts/network/settings) here.

## Git workflow

- Branch: `improve-slush-reject`.
- Conventional-commit message, e.g. `feat(slush): drive and declare reject`.
- Do NOT push or open a PR unless the operator asks.

## Steps

### Step 1 (spike): discover the Slush cancel control

Launch Slush headed, trigger a connect and a sign request from the demo, and snapshot the popup to
find the cancel/reject affordance (text such as "Cancel"/"Reject", or a testid). Record what you
find. The buttons need `click({ force: true })` and the ~2s settle, like `approve`.

**Verify**: you can describe the exact locator that cancels a Slush approval.

### Step 2: implement `reject`

Add a `reject` to the Slush definition modeled on Phantom's, using the discovered locator and Slush's
force-click + settle conventions (reuse the file's `fclick` helper if the control is text-based).

**Verify**: `pnpm typecheck` exit 0; `pnpm lint` exit 0.

### Step 3: verify end to end

Add a Slush reject spec that triggers a request and asserts the dapp sees a user-rejection
(EIP-1193-style `{ code: 4001 }` for EVM has no Sui analogue; assert the dapp's rejection surface as
the other wallets' specs do). Run it headed.

**Verify**: `pnpm test:e2e` passes the new Slush reject case across a couple of runs.

### Step 4: update the docs

In `api-reference.mdx`, move Slush into the list of wallets where `reject` is verified.

**Verify**: `pnpm --filter docs build` exit 0.

## Test plan

- New Slush reject spec in `apps/demo/tests/slush.spec.ts`, structured like the existing Slush
  connect/sign spec. Headed only; do not add to CI.
- Verification: headed Slush reject spec green.

## Done criteria

- [ ] Slush declares `reject`, driven by the discovered cancel locator
- [ ] `wallet.reject()` on Slush no longer throws "does not support reject()"
- [ ] `pnpm typecheck` / `pnpm lint` exit 0
- [ ] `pnpm test:e2e` passes the Slush reject spec (record the run)
- [ ] `api-reference.mdx` lists Slush under verified `reject`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report (do not improvise) if:

- You cannot run headed Slush E2E: do NOT declare `reject` unverified (repo rule). Report the spike
  findings (the locator) so someone with a display can finish.
- The Slush popup has no distinct cancel control (e.g. rejection is closing the window): report this;
  the implementation may differ from Phantom's button-click model.

## Maintenance notes

- This is the open follow-up recorded in `plans/README.md` ("a Slush rejection spec needs `reject` in
  slush.ts first"); mark it resolved there when done.
- If Slush's popup markup changes, the reject locator may need retuning alongside `approve`.
