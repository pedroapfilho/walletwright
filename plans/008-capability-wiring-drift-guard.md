# Plan 008: Guard the capability wiring against silent drift

> **Executor instructions**: Follow step by step; verify each step. STOP conditions halt you. Update
> `plans/README.md` when done unless a reviewer maintains it.
>
> **Drift check (run first)**: `git diff --stat 0f0db25..HEAD -- packages/walletwright/src/internal/controller.ts packages/walletwright/src/types.ts`
> On any change, compare against "Current state"; mismatch means STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 007 (its `controller.test.ts` establishes the stub-definition test pattern this
  plan reuses; do 007 first)
- **Category**: tech-debt
- **Planned at**: commit `0f0db25`, 2026-07-16

## Why this matters

A capability method lives in three places: the definition-side type (`WalletActions`), the runtime
type (`AccountsApi`/`NetworkApi`/`SettingsApi` on `Wallet`), and the hand-written binding in
`createWallet`'s return object. TypeScript catches a runtime-type/binding mismatch, but it does NOT
catch a method that is declared and typed yet accidentally left unwired to the definition (e.g. a
copy-paste that binds `accounts.rename` to `definition.actions?.accounts?.add`). As more capabilities
land, that silent mis-wire is a real risk. Rather than a risky generics refactor to collapse the
three places (which would trade readability for cleverness, against this repo's "minimal language
features" convention), this plan adds a cheap drift-guard test that fails if any capability method
does not dispatch to its matching definition function, plus a short comment documenting the
three-places contract so the next author wires all three.

## Current state

- `packages/walletwright/src/internal/controller.ts` builds the returned `Wallet` by hand
  (`controller.ts:105-134`), one line per capability method, each `action(definition.actions?.<group>?.<method>, "<group>.<method>")`.
- `packages/walletwright/src/types.ts` declares `WalletActions` (definition side, optional functions)
  and the runtime `*Api` types on `Wallet`.
- Plan 007 creates `packages/walletwright/src/internal/controller.test.ts` with a stub-definition
  pattern: a fake `WalletDefinition` cast via `as unknown as WalletDefinition`, a stub context
  `{ pages: () => [] } as unknown as BrowserContext`, and a stub home `{} as unknown as Page`. Reuse
  that exact pattern here.

The full set of capability methods currently wired (verify against `controller.ts` at execution
time, do not trust this list blindly):
`accounts.add`, `accounts.importPrivateKey`, `accounts.rename`, `accounts.switch`,
`network.add`, `network.switch`, `settings.lock`, `settings.unlock`.

Repo conventions: arrow functions, `.ts` extensions, no `as any` (use `as unknown as T`), comments
only for a non-obvious WHY, no long dash (U+2014).

## Commands you will need

| Purpose   | Command (from repo root)               | Expected on success  |
| --------- | -------------------------------------- | -------------------- |
| Typecheck | `pnpm --filter walletwright typecheck` | exit 0, no errors    |
| Lint      | `pnpm --filter walletwright lint`      | 0 warnings 0 errors  |
| Unit test | `pnpm --filter walletwright test`      | all pass (incl. new) |
| Build     | `pnpm --filter walletwright build`     | "Build complete"     |

## Scope

**In scope**:

- `packages/walletwright/src/internal/capability-wiring.test.ts` (create)
- `packages/walletwright/src/internal/controller.ts` (comment-only change: add the contract note)

**Out of scope**:

- Any structural refactor of the capability system. Do NOT introduce generics, mapped types, or a
  registry to collapse the three places. This plan is a test plus a comment only.
- The runtime behavior of `createWallet`. The only source edit permitted is adding a comment.
- `controller.test.ts` from plan 007 (leave it; this plan uses a separate test file).

## Git workflow

- Commit: `test(walletwright): guard capability wiring against silent drift`.
- Do NOT push or open a PR.

## Steps

### Step 1: Add the drift-guard test

Create `packages/walletwright/src/internal/capability-wiring.test.ts`. Build one fake
`WalletDefinition` whose `actions` fully populates every group, with each action function a distinct
`vi.fn()`. Build the wallet with the stub context/home. For every capability method path, call it and
assert its corresponding spy was invoked. This fails if any method is wired to the wrong spy or left
unwired.

Target shape:

```ts
import type { BrowserContext, Page } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";

import type { WalletDefinition } from "../types.ts";

import { createWallet } from "./controller.ts";

describe("capability wiring", () => {
  it("dispatches every declared capability method to its definition function", async () => {
    const spies = {
      accountsAdd: vi.fn(),
      accountsImport: vi.fn(),
      accountsRename: vi.fn(),
      accountsSwitch: vi.fn(),
      networkAdd: vi.fn(),
      networkSwitch: vi.fn(),
      settingsLock: vi.fn(),
      settingsUnlock: vi.fn(),
    };
    const definition = {
      extensionName: "Fake",
      actions: {
        accounts: {
          add: spies.accountsAdd,
          importPrivateKey: spies.accountsImport,
          rename: spies.accountsRename,
          switch: spies.accountsSwitch,
        },
        network: { add: spies.networkAdd, switch: spies.networkSwitch },
        settings: { lock: spies.settingsLock, unlock: spies.settingsUnlock },
      },
    } as unknown as WalletDefinition;

    const wallet = createWallet({
      context: { pages: () => [] } as unknown as BrowserContext,
      definition,
      extensionId: "fake",
      home: {} as unknown as Page,
      password: "pw",
    });

    await wallet.accounts.add();
    await wallet.accounts.importPrivateKey("0xkey");
    await wallet.accounts.rename({ index: 0, name: "x" });
    await wallet.accounts.switch(0);
    await wallet.network.add({ chainId: 1, name: "n", rpcUrl: "u", symbol: "s" });
    await wallet.network.switch(1);
    await wallet.settings.lock();
    await wallet.settings.unlock();

    expect(spies.accountsAdd).toHaveBeenCalledOnce();
    expect(spies.accountsImport).toHaveBeenCalledOnce();
    expect(spies.accountsRename).toHaveBeenCalledOnce();
    expect(spies.accountsSwitch).toHaveBeenCalledOnce();
    expect(spies.networkAdd).toHaveBeenCalledOnce();
    expect(spies.networkSwitch).toHaveBeenCalledOnce();
    expect(spies.settingsLock).toHaveBeenCalledOnce();
    expect(spies.settingsUnlock).toHaveBeenCalledOnce();
  });
});
```

If a method path above no longer exists on `Wallet` (drift), that is a real signal: STOP and report,
do not delete the assertion to make it compile.

**Verify**: `pnpm --filter walletwright test` runs the new file and it passes.

### Step 2: Document the three-places contract

In `controller.ts`, immediately above the `return { ... }` object in `createWallet`, add a short
comment (no code change) stating the contract, so the next author wires all three places. Keep it to
two or three lines, WHY-focused.

Target shape (comment only):

```ts
  // Capability contract: each method is declared in three places that must stay in sync, its
  // optional fn in WalletActions (types.ts), its runtime signature in the *Api types on Wallet, and
  // its binding below. capability-wiring.test.ts guards the binding-to-fn half.
  return {
```

**Verify**: `pnpm --filter walletwright typecheck` exits 0; `pnpm --filter walletwright lint` reports
0 warnings 0 errors.

### Step 3: Build

**Verify**: `pnpm --filter walletwright build` prints "Build complete".

## Test plan

The new `capability-wiring.test.ts` is the deliverable. It asserts each of the eight capability
methods invokes its own spy exactly once, catching a mis-wire (wrong spy) or an unwired method. When
a capability is added later, a new spy + call + assertion line is added here.

## Done criteria

ALL must hold:

- [ ] `pnpm --filter walletwright test` passes, including `capability-wiring.test.ts` which asserts
      all eight capability methods dispatch to their own spy
- [ ] `controller.ts` has a comment above the return object documenting the three-places contract
      (comment only; no runtime change)
- [ ] `git diff packages/walletwright/src/internal/controller.ts` shows only an added comment
- [ ] `pnpm --filter walletwright typecheck` exits 0; no `as any`
- [ ] `pnpm --filter walletwright lint` reports 0 warnings, 0 errors
- [ ] `pnpm --filter walletwright build` prints "Build complete"
- [ ] `git status` shows only `capability-wiring.test.ts` added and `controller.ts` modified
      (comment)
- [ ] `plans/README.md` row for 008 updated (unless the reviewer maintains it)

## STOP conditions

Stop and report if:

- Plan 007 has not landed (no `controller.test.ts` / the stub pattern is absent). Its stub pattern is
  the dependency; if it is missing, note it and stop.
- A capability method path in the test does not exist on `Wallet` (drift): report it.
- The controller edit would need to change any runtime line to satisfy typecheck; it must be
  comment-only. If not, STOP.

## Maintenance notes

- This is intentionally a guardrail, not the generics refactor the audit flagged as an option. If a
  third wallet ever implements the full capability set and the hand-wiring becomes genuinely painful,
  revisit collapsing the three places then, with this test as the safety net.
- Reviewer: confirm the test would actually fail on a mis-wire (spot check by imagining
  `network.add` bound to `spies.networkSwitch`) and that the controller change is comment-only.
