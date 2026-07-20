# Plan 024: Add Rabby as the next verified EVM wallet, discovery + build spike

> **Executor instructions**: EMPIRICAL SPIKE + BUILD. A wallet enters the registry only once its
> connect AND sign are verified end to end against the real extension (repo rule). Never guess
> selectors, drive the real Rabby extension headed. Update this plan's row in `plans/README.md` when
> done.
>
> **Drift check (run first)**: `git diff --stat 993e798..HEAD -- packages/walletwright/src/wallets/index.ts packages/walletwright/src/types.ts packages/walletwright/src/wallets/metamask.ts`
> On a mismatch with the excerpts below, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M (empirical: selector/flow discovery is the unknown)
- **Risk**: LOW (additive; only enters `WalletKind` once verified)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `993e798`, 2026-07-20

## Why this matters

The roadmap targets the top 3 wallets per ecosystem (AGENTS.md). Rabby is the next EVM target and the
cheapest adjacent addition: the engine is wallet-agnostic (a wallet is one `WalletDefinition`
registered in `wallets/index.ts`), MetaMask already exercises the full EVM path (connect,
`personal_sign`, typed-data, transactions, `wallet_addEthereumChain`), and the demo has an EVM
section. Rabby is a MetaMask-like MV3 extension that injects `window.ethereum`, so a second EVM wallet
reuses the most battle-tested code path.

## Current state

- `packages/walletwright/src/wallets/index.ts` is the registry:

```ts
import { metamask } from "./metamask.ts";
import { phantom } from "./phantom.ts";
import { slush } from "./slush.ts";

export const wallets: Record<WalletKind, WalletDefinition> = {
  metamask,
  phantom,
  slush,
};
```

- `packages/walletwright/src/types.ts:10`: `type WalletKind = "metamask" | "phantom" | "slush"`.
- `packages/walletwright/src/wallets/metamask.ts` is the template: a `WalletDefinition` assembled from
  a `metamask/` folder (`onboarding.ts`, `approve.ts`, `actions/*`). Rabby, if its flow is large,
  should follow the same "definition file assembles, folder implements" layout.
- Extension id derivation: MetaMask has no manifest `key` (id derived from the load path); Phantom
  has a fixed Web Store id via its manifest `key`. Discover which applies to Rabby (`utils.ts`
  `extensionIdFromPath` handles both).
- The empirical discovery process is documented in AGENTS.md (download the CRX, launch headed,
  snapshot each onboarding screen: buttons, testids, inputs).

## Commands you will need

| Purpose      | Command                                     | Expected on success |
| ------------ | ------------------------------------------- | ------------------- |
| Install      | `pnpm install`                              | exit 0              |
| Typecheck    | `pnpm typecheck`                            | exit 0              |
| Lint         | `pnpm lint`                                 | exit 0              |
| Unit tests   | `pnpm turbo run test --filter=walletwright` | all pass            |
| E2E (headed) | `pnpm test:e2e`                             | Rabby spec passes   |

Headed E2E with a display is required; this plan cannot be completed without driving the real Rabby
extension.

## Scope

**In scope**:

- `packages/walletwright/src/wallets/rabby.ts` (+ a `rabby/` folder if the flow warrants it)
- `packages/walletwright/src/wallets/index.ts` (register `rabby`)
- `packages/walletwright/src/types.ts` (add `"rabby"` to `WalletKind`)
- `apps/demo/tests/rabby.spec.ts` (connect + sign) and any demo wiring needed (the EVM section exists)
- `packages/walletwright/src/wallets/registry.test.ts` (extend for the new kind if it enumerates)
- Docs: add Rabby to `apps/docs/content/docs/wallets.mdx`, the roadmap table in AGENTS.md, and the
  landing wallet grid, ONLY after connect+sign are verified

**Out of scope**:

- Any optional capability (accounts/network/settings) for Rabby beyond connect/sign in this plan.
- Other roadmap wallets.

## Git workflow

- Branch: `improve-rabby-wallet`.
- Conventional-commit message, e.g. `feat(wallets): add Rabby (EVM), verified connect + sign`.
- Do NOT push or open a PR unless the operator asks.

## Steps

### Step 1 (spike): download and snapshot Rabby's flow

Find Rabby's Chrome Web Store extension id, download the CRX via the existing `prepareWebStoreExtension`
helper pattern (see plan 015; or `downloadAndExtractExtension` with `kind: "crx"`), launch it headed,
and snapshot onboarding, unlock, and the connect/sign approval popups (buttons, testids, inputs,
`notificationMatch` token). Record everything.

**Verify**: you have the exact selectors for import-from-seed, unlock, and the connect/sign confirm
buttons.

### Step 2: implement the definition

Write `rabby.ts` modeled on `metamask.ts` (and its folder if large): `ecosystems: ["evm"]`,
`prepareExtension`, `importWallet`, `reachUnlockScreen`, `unlock`, `approve`, and `reject` if the
cancel control is obvious. Add `"rabby"` to `WalletKind` and register it in `wallets/index.ts`.

**Verify**: `pnpm typecheck` exit 0; `pnpm lint` exit 0; `pnpm turbo run test
--filter=walletwright` all pass (registry test sees the new kind).

### Step 3: verify connect + sign end to end

Add `apps/demo/tests/rabby.spec.ts` (connect + `personal_sign`), modeled on `metamask.spec.ts`. Build
the Rabby cache and run it headed.

**Verify**: `pnpm test:e2e` passes the Rabby spec across a couple of runs.

### Step 4: document (only after verification)

Add Rabby to `wallets.mdx`, the AGENTS.md roadmap table (move from roadmap to verified), and the
landing grid.

**Verify**: `pnpm --filter docs build` and `pnpm --filter landing build` exit 0.

## Test plan

- Headed `rabby.spec.ts` (connect + sign) is the gate, modeled on `metamask.spec.ts`. Headed only; do
  not add to CI.
- Registry/unit: `registry.test.ts` should include `"rabby"` where it enumerates kinds.

## Done criteria

- [ ] `rabby.ts` exists and is registered; `WalletKind` includes `"rabby"`
- [ ] `pnpm typecheck` / `pnpm lint` exit 0
- [ ] `pnpm turbo run test --filter=walletwright` exits 0
- [ ] `pnpm test:e2e` passes the Rabby connect + sign spec (record the run)
- [ ] Docs and roadmap updated to list Rabby as verified
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report (do not improvise) if:

- You cannot run headed E2E: do NOT register Rabby unverified (repo rule). Deliver the spike findings
  (selectors) so someone with a display can finish.
- Rabby's onboarding differs enough that the MetaMask template does not transfer (report the
  differences).

## Maintenance notes

- Keep Rabby out of `WalletKind`/the registry until connect + sign are green; a half-verified wallet
  breaks the registry's honesty guarantee.
- If Rabby has no manifest `key`, its id is path-derived like MetaMask; confirm via `utils.ts`.
