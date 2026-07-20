# Plan 022: Resolve the `network.switch` API trap (no wallet implements it)

> **Executor instructions**: DECISION PLAN. It asks you to make one API call: deprecate-in-docs vs
> remove from the type. Read "Why", pick per the decision guide, implement that path only, and update
> this plan's row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 993e798..HEAD -- packages/walletwright/src/types.ts packages/walletwright/src/internal/controller.ts apps/docs/content/docs/api-reference.mdx`
> On a mismatch with the excerpts below, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S (deprecate-in-docs) or M (remove from type, breaking)
- **Risk**: LOW (docs) or MED (type removal is a breaking change)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `993e798`, 2026-07-20

## Why this matters

`NetworkApi.switch` is on the public `Wallet.network` surface (`types.ts:129-132`) but no wallet
implements it, so `wallet.network.switch(chainId)` always throws `[walletwright] <wallet> does not
support network.switch()`. IDE autocomplete offers it, making it a discoverability trap. This is
grounded in MetaMask 13.x having no wallet-side network selector (AGENTS.md items 15-16): switching is
dapp-initiated via `wallet_addEthereumChain` + `wallet.approve()`, which `examples.mdx:337-357`
already documents. So the method advertises a capability the ecosystem does not currently support.

## Current state

- `packages/walletwright/src/types.ts:128-132`:

```ts
/** Add and switch networks from the wallet's own UI. Throws if the wallet doesn't declare support. */
export type NetworkApi = {
  add: (config: NetworkConfig) => Promise<void>;
  switch: (chainId: number) => Promise<void>;
};
```

- `packages/walletwright/src/types.ts:55-58`, the optional definition side:

```ts
export type NetworkActions = {
  add?: (ctx: WalletActionContext, config: NetworkConfig) => Promise<void>;
  switch?: (ctx: WalletActionContext, chainId: number) => Promise<void>;
};
```

- `packages/walletwright/src/internal/controller.ts:131-134` binds `network.switch` to
  `action(definition.actions?.network?.switch, "network.switch")`, which throws when undeclared.
- `apps/docs/content/docs/api-reference.mdx:141` already states "`network.switch` is declared by no
  wallet yet" and steers users to the `wallet_addEthereumChain` recipe.

## Decision guide

Pick ONE:

- **Option A, deprecate-in-docs (recommended, S, LOW risk)**: keep the method (no breaking change) but
  mark it clearly experimental/unsupported in the TSDoc so autocomplete shows the caveat, and keep the
  api-reference note. Choose this if preserving API stability matters and a wallet-side switch might
  arrive later (a future wallet/version could implement it).
- **Option B, remove from the public type (M, MED risk, breaking)**: drop `switch` from `NetworkApi`,
  the `NetworkActions.switch` optional, and the controller binding, leaning fully on the documented
  dapp-initiated recipe. Choose this only if the maintainer wants the public surface to advertise only
  what works and is willing to ship a breaking `NetworkApi` change (note it in a changeset).

Default: **Option A** unless the operator says otherwise.

## Commands you will need

| Purpose    | Command                                     | Expected on success |
| ---------- | ------------------------------------------- | ------------------- |
| Install    | `pnpm install`                              | exit 0              |
| Typecheck  | `pnpm typecheck`                            | exit 0              |
| Lint       | `pnpm lint`                                 | exit 0              |
| Unit tests | `pnpm turbo run test --filter=walletwright` | all pass            |
| Docs build | `pnpm --filter docs build`                  | exit 0              |

## Scope

**In scope**:

- `packages/walletwright/src/types.ts`
- `apps/docs/content/docs/api-reference.mdx`
- Option B only: `packages/walletwright/src/internal/controller.ts`, plus a changeset under
  `.changeset/` describing the breaking change, and `capability-wiring.test.ts` if it references
  `network.switch`.

**Out of scope**:

- `network.add` (it is implemented for MetaMask; leave it).
- Implementing a real wallet-side switch (impossible on current MetaMask per AGENTS.md).

## Git workflow

- Branch: `improve-network-switch-decision`.
- Conventional-commit message: Option A `docs(types): mark network.switch experimental/unsupported`;
  Option B `refactor(types)!: remove unimplemented network.switch` (note the `!`).
- Do NOT push or open a PR unless the operator asks.

## Steps (Option A)

### Step 1: Document the caveat on the type

Add a TSDoc comment on `NetworkApi.switch` stating no wallet implements it today and it throws;
point to the `wallet_addEthereumChain` recipe. Keep the signature.

**Verify**: `pnpm typecheck` exit 0; `pnpm lint` exit 0.

### Step 2: Keep the api-reference note aligned

Confirm `api-reference.mdx:141` still reflects the caveat (it does today). Adjust wording only if the
TSDoc phrasing changed.

**Verify**: `pnpm --filter docs build` exit 0.

## Steps (Option B, only if chosen)

1. Remove `switch` from `NetworkApi` (`types.ts:129-132`) and `NetworkActions` (`types.ts:55-58`).
2. Remove the `network.switch` binding in `controller.ts:133`.
3. Update `capability-wiring.test.ts` if it enumerates `network.switch`.
4. Update `api-reference.mdx` to drop the `network.switch` paragraph and keep only the dapp-initiated
   recipe pointer.
5. Add a changeset (`.changeset/<name>.md`) marking a breaking `NetworkApi` change.

**Verify** (Option B): `pnpm typecheck`, `pnpm lint`, `pnpm turbo run test --filter=walletwright`,
`pnpm --filter docs build` all exit 0.

## Done criteria

- [ ] One option implemented (A or B), not a mix
- [ ] `pnpm typecheck` / `pnpm lint` exit 0
- [ ] `pnpm turbo run test --filter=walletwright` exits 0
- [ ] `pnpm --filter docs build` exits 0
- [ ] Option B only: a changeset exists describing the breaking change
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- The excerpts no longer match "Current state".
- You are unsure which option the maintainer wants and it is Option B (breaking): default to Option A
  and note that B is available.

## Maintenance notes

- If a wallet/version ever gains a real wallet-side switch, Option A leaves the seam in place to
  implement it; Option B would require re-adding the type.
