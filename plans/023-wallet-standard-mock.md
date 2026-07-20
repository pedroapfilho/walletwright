# Plan 023: Extend the mock wallet beyond EVM (Wallet-Standard variant), design spike

> **Executor instructions**: DESIGN SPIKE. The deliverable is a prototype plus a written API proposal
> and open-questions list, NOT a finished feature. Do not ship a public API without maintainer
> sign-off on the design. Update this plan's row in `plans/README.md` when the spike is done.
>
> **Drift check (run first)**: `git diff --stat 993e798..HEAD -- packages/walletwright/src/mock.ts apps/demo/src/wallet-standard.ts`
> On a mismatch with the excerpts below, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M (spike)
- **Risk**: LOW (new optional entry point, isolated from the extension core)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `993e798`, 2026-07-20

## Why this matters

The mock wallet's selling point is testing a dapp's connect/sign wiring headless in a second or two
(`examples.mdx` "the mock wallet" section). Today it is EVM-only: it injects `window.ethereum`
(`mock.ts:89`) and answers only `eth_requestAccounts`/`eth_accounts`/`eth_chainId`/`personal_sign`
(`mock.ts:31-48`). But the library headlines EVM + Solana + Sui, and the demo already wires a
Wallet-Standard client (`apps/demo/src/wallet-standard.ts`) used by the Slush and MetaMask-Solana
specs. Solana/Sui dapp authors currently get no fast headless path. A Wallet-Standard mock would
extend the cheapest testing path to the other two ecosystems the project already supports.

## Current state

- `packages/walletwright/src/mock.ts` is EVM/EIP-6963 only. Excerpt:

```ts
// mock.ts:26-53 (abridged): the EIP-1193 handler
const createRpcHandler =
  (account, chainIdHex) =>
  ({ method, params = [] }) => {
    switch (method) {
      case "eth_requestAccounts":
      case "eth_accounts":
        return Promise.resolve([account.address]);
      case "eth_chainId":
        return Promise.resolve(chainIdHex);
      case "personal_sign": {
        /* signs with viem account */
      }
      case "wallet_switchEthereumChain":
      case "wallet_addEthereumChain":
        return Promise.resolve(null);
      default:
        return Promise.reject(new Error(`[walletwright/mock] unsupported method: ${method}`));
    }
  };
// mock.ts:79-110: addInitScript announces over EIP-6963 and sets window.ethereum
```

- `walletwright/mock` is a separate entry point needing `viem` (optional peer).
- `apps/demo/src/wallet-standard.ts` is the client-side reference for how the demo connects to a
  Wallet-Standard wallet (used by the Slush and MetaMask-Solana specs); read it to learn the exact
  registration and feature surface (`standard:connect`, `solana:signMessage`,
  `sui:signPersonalMessage`).

## Commands you will need

| Purpose    | Command                                     | Expected on success |
| ---------- | ------------------------------------------- | ------------------- |
| Install    | `pnpm install`                              | exit 0              |
| Typecheck  | `pnpm typecheck`                            | exit 0              |
| Unit tests | `pnpm turbo run test --filter=walletwright` | all pass            |
| E2E/demo   | `pnpm test:e2e`                             | prototype spec runs |

## Scope

**In scope (spike)**:

- A prototype `walletwright/mock` Wallet-Standard variant (new file, e.g. `src/mock-standard.ts`, or
  an option on the existing entry, that is one of the open questions to decide).
- A throwaway demo spec proving a Solana (and/or Sui) connect + sign against the mock.
- A written proposal (add it to this plan's "Findings" section or a `plans/023-notes.md`): the API
  shape, the signing surface to mock per ecosystem, packaging (new subpath vs option), and open
  questions.

**Out of scope**:

- The existing EVM mock behavior (do not change `mock.ts` EVM handling in the spike).
- Shipping a finalized public API without maintainer sign-off.

## Git workflow

- Branch: `improve-wallet-standard-mock-spike`.
- Conventional-commit message, e.g. `spike(mock): prototype Wallet-Standard mock`.
- Do NOT push or open a PR unless the operator asks.

## Steps

### Step 1: Study the client contract

Read `apps/demo/src/wallet-standard.ts` and the Slush + MetaMask-Solana specs to enumerate exactly
which Wallet-Standard features a connect + sign flow calls (`standard:connect`, and the per-ecosystem
sign feature). Record them.

**Verify**: you can list the minimal feature set the mock must announce for Solana and for Sui.

### Step 2: Prototype the announcer

Build a minimal Wallet-Standard provider that registers itself (mirroring how the EIP-6963 mock
announces) and answers `standard:connect` plus the sign feature(s), signing with a real key so
signatures verify (reuse the `viem` account pattern for Solana if feasible, or an appropriate signer).

**Verify**: a throwaway demo spec connects and signs on Solana (and/or Sui) against the mock, headless.

### Step 3: Write the proposal

Document: entry-point shape (new `walletwright/mock-standard` vs an `ecosystem` option on
`installMockWallet`), the signer per ecosystem, optional-peer implications, and open questions (e.g.
Sui signing key format). This is the real deliverable.

**Verify**: the proposal answers "what API would we ship and what is unresolved".

## Test plan

- Spike only: a throwaway demo spec is the proof. Do not add it to CI or ship it as the final test
  suite; the finalized tests come with the follow-up implementation plan.

## Done criteria

- [ ] A working prototype connects + signs on at least one non-EVM ecosystem against the mock,
      headless
- [ ] A written proposal exists (API shape, signer, packaging, open questions)
- [ ] `pnpm typecheck` exits 0 for the prototype
- [ ] `plans/README.md` status row updated (and a follow-up implementation plan proposed if the design
      is accepted)

## STOP conditions

Stop and report if:

- The Wallet-Standard signing surface for Sui/Solana cannot be mocked without a heavy dependency
  (report the dependency cost as an open question rather than pulling it in).
- The prototype would require changing the EVM mock's behavior (keep them isolated).

## Maintenance notes

- Keep the Wallet-Standard mock in its own module/entry so the EVM mock and the extension core stay
  independent.
- The follow-up build plan should add real tests and docs once the API is signed off.
