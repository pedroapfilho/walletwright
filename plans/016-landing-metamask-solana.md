# Plan 016: Show MetaMask's verified Solana support on the landing page

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If anything in "STOP conditions" occurs, stop and
> report. When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 993e798..HEAD -- apps/landing/src/components/wallets.tsx apps/landing/src/components/features.tsx packages/walletwright/src/wallets/metamask.ts`
> If any of these changed, compare the "Current state" excerpts against the live code before
> proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `993e798`, 2026-07-20

## Why this matters

MetaMask on Solana is shipped and verified end to end (`metamask.ts` declares `ecosystems: ["evm",
"svm"]`; there is a passing spec `apps/demo/tests/metamask-solana.spec.ts`; every other doc surface
says "MetaMask (EVM + Solana)"). The landing page is the one place that still presents MetaMask as
EVM-only: the wallet grid has no MetaMask/Solana card, and the features copy attaches Solana to
Phantom only. The marketing page therefore hides a genuine differentiator exactly where it would win
adoption. This is a copy/JSX fix to make the landing match reality.

## Current state

- `packages/walletwright/src/wallets/metamask.ts:16`:

```ts
ecosystems: ["evm", "svm"],
```

- `apps/landing/src/components/wallets.tsx:16-37`, four cards; no MetaMask/Solana one:

```tsx
const TARGETS: Array<Target> = [
  {
    capability: "Connect, personal_sign, typed-data, and transactions.",
    chain: { icon: <NetworkEthereum aria-hidden size={18} variant="branded" />, name: "EVM" },
    wallet: { icon: <WalletMetamask aria-hidden size={32} variant="branded" />, name: "MetaMask" },
  },
  {
    /* Phantom EVM */
  },
  {
    /* Phantom Solana, chain icon NetworkSolana */
  },
  {
    /* Slush Sui */
  },
];
```

- Imports at `wallets.tsx:1-7`: `NetworkEthereum, NetworkSolana, NetworkSui, WalletMetamask,
WalletPhantom` from `@web3icons/react`. `NetworkSolana` and `WalletMetamask` are already imported,
  so the new card needs no new import.
- The grid uses `sm:grid-cols-2 lg:grid-cols-4` (`wallets.tsx:53`). Four cards fill the `lg` row
  evenly; a fifth wraps. See Step 3.
- `apps/landing/src/components/features.tsx:47-48`, the misleading parenthetical:

```tsx
description:
  "connectToDapp() and confirmSignature() drive MetaMask, Phantom (EVM and Solana), and Slush (Sui) the same way.",
```

## Commands you will need

| Purpose      | Command                           | Expected on success |
| ------------ | --------------------------------- | ------------------- |
| Install      | `pnpm install`                    | exit 0              |
| Typecheck    | `pnpm --filter landing typecheck` | exit 0              |
| Lint         | `pnpm --filter landing lint`      | exit 0              |
| Build        | `pnpm --filter landing build`     | exit 0              |
| Format check | `pnpm format:check`               | all formatted       |

## Scope

**In scope** (only files you should modify):

- `apps/landing/src/components/wallets.tsx`
- `apps/landing/src/components/features.tsx`

**Out of scope** (do NOT touch):

- The docs site (`apps/docs/**`) and READMEs (already state MetaMask EVM + Solana correctly).
- The library source (no code change; marketing copy only).

## Git workflow

- Branch: `improve-landing-metamask-solana`.
- Conventional-commit message, e.g. `docs(landing): show MetaMask Solana support`.
- Do NOT push or open a PR unless the operator asks.

## Steps

### Step 1: Add a MetaMask/Solana card

Insert a fifth `TARGET` (prefer placing it right after the MetaMask/EVM card so the two MetaMask cards
group). Reuse the imported `WalletMetamask` and `NetworkSolana`:

```tsx
{
  capability: "Connect and sign through the Solana Wallet Standard.",
  chain: { icon: <NetworkSolana aria-hidden size={18} variant="branded" />, name: "Solana" },
  wallet: { icon: <WalletMetamask aria-hidden size={32} variant="branded" />, name: "MetaMask" },
},
```

**Verify**: `pnpm --filter landing typecheck` exit 0.

### Step 2: Fix the features copy

In `features.tsx`, reword so Solana is not scoped to Phantom. Target (single sentence, no em-dash):

```tsx
description:
  "connectToDapp() and confirmSignature() drive MetaMask and Phantom on EVM and Solana, and Slush on Sui, the same way.",
```

**Verify**: `pnpm --filter landing typecheck` exit 0.

### Step 3: Check the five-card layout

The grid is `lg:grid-cols-4`, so a fifth card wraps to a second row. Confirm it looks acceptable in
the build; if unbalanced, change the grid class at `wallets.tsx:53` to `lg:grid-cols-3` (5 = 3 + 2)
or `lg:grid-cols-5` (single row), whichever reads better. Either is in scope; do NOT restructure the
component beyond the grid-cols class.

**Verify**: `pnpm --filter landing build` exit 0.

### Step 4: Format and lint

**Verify**: `pnpm format:check` all formatted (run `pnpm format` if not); `pnpm --filter landing lint`
exit 0.

## Test plan

- The landing app has no unit tests; verification is typecheck + lint + a successful production build.
- Optional manual check: `pnpm --filter landing dev`, confirm the grid shows a "MetaMask / Solana"
  card and the features section no longer implies MetaMask is EVM-only.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `TARGETS` in `wallets.tsx` has a second MetaMask entry with chain name "Solana"
- [ ] `features.tsx` no longer contains the string `Phantom (EVM and Solana)`
- [ ] `pnpm --filter landing typecheck` exits 0
- [ ] `pnpm --filter landing lint` exits 0
- [ ] `pnpm --filter landing build` exits 0
- [ ] `pnpm format:check` reports all formatted
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report (do not improvise) if:

- `@web3icons/react` does not export `WalletMetamask` or `NetworkSolana` at build time.
- The `TARGETS` array shape (the `Target` type) changed since this plan.

## Maintenance notes

- The Slush card intentionally reuses `NetworkSui` as its wallet icon (no Slush brand mark in
  `@web3icons/react`); that is tracked in plan 026 and is not part of this change.
- If a future wallet gains a new ecosystem, add a card here so the landing keeps parity with
  `ecosystems` in the wallet definitions.
