# Plan 004: Stop `NetworkConfig` from advertising a `blockExplorerUrl` it ignores

> **Executor instructions**: Follow step by step; verify each step. STOP conditions halt you. Update
> `plans/README.md` when done unless a reviewer maintains it.
>
> **Drift check (run first)**:
> `git diff --stat 0f0db25..HEAD -- packages/walletwright/src/types.ts packages/walletwright/src/wallets/metamask/actions/network.ts apps/docs/content/docs/api-reference.mdx`
> On any change to these files, compare against "Current state"; mismatch means STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `0f0db25`, 2026-07-16

## Why this matters

`NetworkConfig` declares an optional `blockExplorerUrl`, but `network.add` never fills the block
explorer field in MetaMask's add-network form, so passing it does nothing. An API that accepts a
field and silently drops it is a lie that costs debugging time. This is a brand-new, unreleased type
(it lives only on the current feature branch), so removing the field is not a breaking change to any
published consumer. Removing it makes the type honest: it lists exactly what the flow uses.

(Alternative considered and deferred: actually wire the explorer sub-form. Rejected for now because
it adds another nested-modal UI interaction to drive with no verified end-to-end test, against the
repo rule that capabilities ship only once driven. Removing the field is the low-risk honest move;
re-add it wired, with a test, when someone needs it.)

## Current state

- `packages/walletwright/src/types.ts` defines `NetworkConfig`:

```ts
/** A custom EVM network, as the wallet's add-network form expects it. */
export type NetworkConfig = {
  blockExplorerUrl?: string;
  chainId: number;
  name: string;
  rpcUrl: string;
  symbol: string;
};
```

- `packages/walletwright/src/wallets/metamask/actions/network.ts` `add` uses `config.name`,
  `config.chainId`, `config.symbol`, `config.rpcUrl`, and never `config.blockExplorerUrl`
  (`network.ts:15-38`).

- `apps/docs/content/docs/api-reference.mdx` documents the field in two places: the `type Wallet`
  block includes a `NetworkConfig` with `blockExplorerUrl?: string;` (around line 98-104), and the
  `network.add(config)` table row (around line 121). Search for `blockExplorerUrl` to find the exact
  current lines.

Repo conventions: `type` over `interface`, alphabetically-sorted object type members (oxlint
`sort-keys` is enforced, so keep the remaining keys sorted), no long dash (U+2014).

## Commands you will need

| Purpose    | Command (from repo root)                      | Expected on success                         |
| ---------- | --------------------------------------------- | ------------------------------------------- |
| Typecheck  | `pnpm --filter walletwright typecheck`        | exit 0, no errors                           |
| Lint       | `pnpm --filter walletwright lint`             | 0 warnings 0 errors                         |
| Build      | `pnpm --filter walletwright build`            | "Build complete"                            |
| Docs lint  | `pnpm --filter docs lint`                     | 0 errors                                    |
| Grep check | `grep -rn "blockExplorerUrl" packages/ apps/` | only intended remaining refs (ideally none) |

## Scope

**In scope**:

- `packages/walletwright/src/types.ts` (remove the `blockExplorerUrl` line from `NetworkConfig`)
- `apps/docs/content/docs/api-reference.mdx` (remove the field from the `NetworkConfig` code block
  and any mention in the `network.add` description)

**Out of scope**:

- `network.ts` add logic (it already ignores the field; no change needed).
- `apps/docs/content/docs/examples.mdx` if it does not mention `blockExplorerUrl` (grep first; only
  touch it if a reference exists there).
- Any other type in `types.ts`.

## Git workflow

- Commit: `refactor(walletwright): drop unused NetworkConfig.blockExplorerUrl`.
- Do NOT push or open a PR.

## Steps

### Step 1: Remove the field from the type

Delete the `blockExplorerUrl?: string;` line from `NetworkConfig` in `types.ts`. Keep the remaining
members alphabetically sorted (`chainId`, `name`, `rpcUrl`, `symbol`).

**Verify**: `pnpm --filter walletwright typecheck` → exit 0 (nothing references the field).

### Step 2: Remove it from the docs

In `api-reference.mdx`, delete the `blockExplorerUrl?: string;` line from the `NetworkConfig` code
block, and remove any clause mentioning a block explorer from the `network.add` row. Do not reword
surrounding prose beyond what the removal requires.

**Verify**: `grep -rn "blockExplorerUrl" packages/ apps/` → no matches. Then `pnpm --filter docs lint`
→ 0 errors.

### Step 3: Build

**Verify**: `pnpm --filter walletwright lint` → 0 warnings 0 errors; `pnpm --filter walletwright build`
→ "Build complete".

## Test plan

No test change: this removes an unused field. The `grep` returning no matches is the regression gate.

## Done criteria

ALL must hold:

- [ ] `grep -rn "blockExplorerUrl" packages/ apps/` returns no matches
- [ ] `pnpm --filter walletwright typecheck` exits 0
- [ ] `pnpm --filter walletwright lint` reports 0 warnings, 0 errors
- [ ] `pnpm --filter walletwright build` prints "Build complete"
- [ ] `pnpm --filter docs lint` reports 0 errors
- [ ] `git status` shows only `types.ts` and `api-reference.mdx` modified (plus `examples.mdx` only if
      it had a reference)
- [ ] `plans/README.md` row for 004 updated (unless the reviewer maintains it)

## STOP conditions

Stop and report if:

- Typecheck fails after Step 1 because something DOES reference `config.blockExplorerUrl`: that
  contradicts the finding. Report the reference instead of deleting its use.
- The `NetworkConfig` excerpt does not match the live type (drift).

## Maintenance notes

- If block-explorer support is wanted later, re-add the field AND wire it into the add-network form
  (`test-explorer-drop-down` was observed in MetaMask's form), with an end-to-end demo spec proving
  it lands.
- Reviewer: confirm no runtime code path lost behavior (there was none) and that the docs no longer
  mention the field.
