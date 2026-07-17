# Plan 011: Demo cleanup: shared wallet-standard helper, error surfaces, spec fixtures

> **Executor instructions**: Follow step by step; verify each step. STOP conditions halt you. Do not
> update `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 0060500..HEAD -- apps/demo`
> Empty means no drift; proceed. If plan 010 already landed in your worktree history that is fine;
> this plan touches only `apps/demo`.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (demo-only; fully covered by the demo specs)
- **Depends on**: none (branch directly off base; do not stack on 010)
- **Category**: tech-debt + bug
- **Planned at**: commit `0060500`, 2026-07-17
- **PR grouping**: one PR (branch `improve-demo-cleanup`)

## Why this matters

Three demo problems. (1) The MetaMask-Solana section (`apps/demo/src/main.ts` ~150-197) and the
Slush-Sui section (~199-244) duplicate the Wallet-Standard plumbing nearly line-for-line
(structurally identical wallet/account types, a find-by-chain-prefix getter, an identical
`standard:connect` handler); every future Wallet-Standard wallet copies ~45 more lines, which is
what pushes main.ts (279 lines) toward the repo's 400-line cap. (2) The four Solana/Sui handlers
have no try/catch and no on-page error span, unlike the EVM sections, so a rejection or missing
provider is an unhandled promise rejection with nothing rendered for a spec to read (the Phantom-SVM
handlers share this gap; fix them too for consistency). (3) All ten specs repeat the
`createWalletFixtures` header and five repeat the goto/click/connect triple, so a change touches
every file in lockstep.

## Current state

- `apps/demo/src/main.ts`: sections in order: EVM (with `showError(error, target)` helper and
  `#error` span usage), Phantom EVM (uses `#phantomEvmError`), Phantom SVM (NO try/catch),
  MetaMask Solana (NO try/catch, `SolanaStandardWallet`/`SolanaStandardAccount` types,
  `getMetamaskSolana` selecting by `name === "MetaMask"` + chain prefix `solana:`), Slush Sui (NO
  try/catch, `StandardWallet`/`SuiAccount` types, `getSuiWallet` selecting by chain prefix `sui:`),
  then the listener block at the bottom.
- `apps/demo/index.html`: EVM section has `<p>Error: <span id="error"></span></p>`; Phantom EVM has
  `#phantomEvmError`; Phantom SVM, MetaMask Solana, and Sui sections have NO error span.
- Specs (`apps/demo/tests/`): metamask, metamask-actions, metamask-network, metamask-transaction,
  metamask-accounts, metamask-solana, phantom, phantom-actions, slush, privy, mock. All but mock
  start with `const test = createWalletFixtures(<setup>); const { expect } = test;`. The connect
  triple `goto("/")` + `#connectButton` click + `connectToDapp()` appears in metamask.spec.ts,
  metamask-actions.spec.ts (x2), metamask-network.spec.ts (x2), metamask-transaction.spec.ts
  (beforeEach).
- The docs' composing-fixtures recipe (examples.mdx "Composing your own fixtures") is the blessed
  pattern to mirror.

Conventions: arrow functions, `.ts` import extensions, no `as any`, comments only for non-obvious
WHY, no long dash (U+2014). Keep ids in index.html unchanged (specs and docs reference them).

## Commands you will need

| Purpose       | Command (repo root)                                             | Expected            |
| ------------- | --------------------------------------------------------------- | ------------------- |
| Typecheck     | `pnpm turbo typecheck --force`                                  | no error TS         |
| Lint          | `pnpm --filter demo lint`                                       | 0/0                 |
| Build         | `pnpm --filter demo build`                                      | vite build succeeds |
| Cache (once)  | `cd apps/demo && node scripts/cache-one.ts metamask --headless` | cache path printed  |
| Headed verify | see Step 4                                                      | specs pass          |

## Scope

**In scope**: `apps/demo/src/main.ts`, `apps/demo/index.html`, `apps/demo/tests/*.spec.ts` (headers
and connect boilerplate only), new files `apps/demo/src/wallet-standard.ts` and
`apps/demo/tests/fixtures.ts`.

**Out of scope**: `packages/walletwright/**` (no library changes); `apps/demo/tests/mock.spec.ts`
(plain playwright, leave); the privy.spec.ts gating logic; `playwright.config.ts`; element ids.

## Git workflow

Branch `improve-demo-cleanup` off base. One commit:
`refactor(demo): shared wallet-standard helper, error surfaces on every section, spec fixtures`.
Do NOT push.

## Steps

### Step 1: Extract the wallet-standard helper

Create `apps/demo/src/wallet-standard.ts` exporting one shared type pair and two helpers:

```ts
import { getWallets } from "@wallet-standard/app";

type StandardAccount = { address: string };
type StandardWallet = {
  accounts: ReadonlyArray<StandardAccount>;
  chains: ReadonlyArray<string>;
  features: Record<string, unknown>;
  name: string;
};

const findStandardWallet = (predicate: (wallet: StandardWallet) => boolean) =>
  getWallets()
    .get()
    .find((wallet) => predicate(wallet as StandardWallet)) as StandardWallet | undefined;

const connectStandard = async (wallet: StandardWallet): Promise<StandardAccount | undefined> => {
  const feature = wallet.features["standard:connect"] as {
    connect: () => Promise<{ accounts: ReadonlyArray<StandardAccount> }>;
  };
  const { accounts } = await feature.connect();
  return accounts[0];
};

export { connectStandard, findStandardWallet };
export type { StandardAccount, StandardWallet };
```

Rewrite the MetaMask-Solana and Slush-Sui sections in `main.ts` to use it (each keeps only its own
`waitFor(() => findStandardWallet(...))` predicate and its sign handler; delete the duplicated local
types). Keep the Phantom sections as they are (they use injected providers, not the standard).

**Verify**: `pnpm turbo typecheck --force` clean; `pnpm --filter demo build` succeeds.

### Step 2: Error surfaces everywhere

`index.html`: add `<p>Error: <span id="phantomSvmError"></span></p>`, `#mmSvmError`, `#suiError`
spans to their sections. `main.ts`: wrap the Phantom-SVM, MetaMask-Solana, and Sui connect+sign
handlers in try/catch calling the existing `showError(error, "#<id>")` helper (clear the span at
handler start, matching the EVM handlers).

**Verify**: `pnpm --filter demo lint` 0/0; grep shows each new span id appears in both files.

### Step 3: Spec fixtures

Create `apps/demo/tests/fixtures.ts` exporting per-wallet ready-made tests and a connect helper:

```ts
import type { Page } from "@playwright/test";
import { createWalletFixtures } from "walletwright";
import type { Wallet } from "walletwright";

import { metamaskSetup, phantomSetup, slushSetup } from "../wallet-setup.ts";

export const metamaskTest = createWalletFixtures(metamaskSetup);
export const phantomTest = createWalletFixtures(phantomSetup);
export const slushTest = createWalletFixtures(slushSetup);

/** The EVM baseline: open the dapp, connect MetaMask, wait for the account. */
export const connectMetamask = async (page: Page, wallet: Wallet): Promise<void> => {
  await page.goto("/");
  await page.locator("#connectButton").click();
  await wallet.connectToDapp();
  await page.locator("#accounts").waitFor();
};
```

Update the specs to import from it: replace each spec's two-line header with
`const test = metamaskTest; const { expect } = test;` (or phantom/slush accordingly; privy.spec.ts
uses metamaskTest too), and replace the verbatim goto/click/connect triples in metamask.spec.ts,
metamask-actions.spec.ts, metamask-network.spec.ts, metamask-transaction.spec.ts with
`await connectMetamask(page, wallet);` where the surrounding assertions allow (keep any
account-text assertion that follows). Do not touch mock.spec.ts.

**Verify**: typecheck clean; `grep -rln "createWalletFixtures" apps/demo/tests/` returns only
`fixtures.ts`.

### Step 4: Headed verification

Build the metamask cache if absent (`node scripts/cache-one.ts metamask --headless`), also phantom
(`... phantom --headless`). Then:

```
cd apps/demo && pnpm exec playwright test tests/metamask.spec.ts tests/metamask-actions.spec.ts tests/metamask-accounts.spec.ts tests/metamask-solana.spec.ts tests/phantom.spec.ts tests/phantom-actions.spec.ts --retries=1
```

**Verify**: all pass. (Network/transaction specs need anvil; run them too if `~/.foundry/bin/anvil`
exists, else note the omission. Slush is known-broken: skip. Privy: runs only with a local .env; if
apps/demo/.env is absent it self-skips, that is fine.)

## Done criteria

- [ ] `wallet-standard.ts` exists; Solana and Sui sections consume it; duplicated types gone
- [ ] every wallet section has an error span and try/catch handlers
- [ ] `fixtures.ts` exists; no spec except it calls `createWalletFixtures`
- [ ] main.ts is under 400 lines
- [ ] typecheck, demo lint, demo build green; format:check clean
- [ ] headed suite from Step 4 passes
- [ ] `git status` clean apart from in-scope files

## STOP conditions

- The wallet-standard refactor changes any observable behavior in the headed run (a spec that
  passed at base now fails twice): report the diff, do not add compensating waits.
- Rewriting a spec would change what it asserts (only the setup boilerplate may change).

## Maintenance notes

- New Wallet-Standard wallets (Solflare, Backpack, Suiet...) should use `findStandardWallet` +
  `connectStandard`; only their sign feature differs.
- Reviewer: check the fixtures refactor did not weaken any assertion (diff should show boilerplate
  swaps only) and that error spans render EIP-1193 `.message` via the existing showError.
