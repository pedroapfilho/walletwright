# Wallet actions: Synpress feature parity on a single engine

Date: 2026-07-16
Status: approved, PR 1 in progress

## Goal

Close the capability gap with Synpress (`synpress-io/synpress`, `dev`) without giving up what
walletwright is: one wallet-agnostic engine, plain `@playwright/test`, no fork, and nothing in the
public API that has not been driven against a real extension.

Synpress exposes ~35 MetaMask and ~20 Phantom methods. walletwright exposes three (`approve`,
`confirmSignature`, `connectToDapp`), and two of those are the same call with a different flag.

Out of scope, decided: **no Cypress runner**. Playwright only. It contradicts the "plain
`@playwright/test`, no patched deps" positioning and doubles the maintained surface forever.

## Constraint that shapes everything

`AGENTS.md`: a capability lands only once it is verified end-to-end. Looking done is not enough.

Synpress pins Playwright 1.48.2 and older wallet builds. Their selectors are evidence of _where to
look_, not a source of truth. MetaMask 13.35's gas and settings UI in particular has moved. Every
action is therefore discovered by driving the real extension, and anything that cannot be verified
gets reported rather than merged.

## Design

### Capability groups (approach B)

The actions are not universal. `addNetwork` is meaningless for Slush (Sui), `approveTokenPermission`
is EVM-only, and Phantom's settings UI has no analogue for half of MetaMask's. Synpress avoids the
problem by giving each wallet its own package and abstract class, with no shared engine. We have one
engine and a registry, so capabilities must be optional and introspectable, or
`wallets.slush.addNetwork` becomes a lie that typechecks.

`WalletDefinition` gains an optional `actions` group. The engine mirrors it onto `Wallet` and throws
`[walletwright] <wallet> does not support <action>` for anything a wallet does not declare.

```ts
type WalletActions = {
  accounts?: AccountActions; // add, switch, rename, importFromPrivateKey, address, reset
  network?: NetworkActions; // add, switch, approveNew/rejectNew, approveSwitch/rejectSwitch
  settings?: SettingsActions; // lock, unlock, open, toggleTestnets
  tokens?: TokenActions; // approvePermission({spendLimit, gas}), rejectPermission, add
};
```

Each action receives a single context object (`{ home, context, extensionId, password }`) rather than
positional arguments, so adding a dependency later does not churn every wallet definition.

Rejected alternatives:

- **Flat optional methods** (`wallet.addNetwork?.()`): matches Synpress's shape, but every call site
  needs `?.` and TypeScript cannot tell you Slush lacks it until runtime.
- **Typed capability map with generics** (`createWalletFixtures<"metamask">`): best DX, unsupported
  calls become compile errors, but the generic plumbing infects `WalletSetup` and the fixtures.
  Revisit if the `?.` noise bites.

### Core surface

Stays flat, because it is universal across wallets: `approve`, `reject`, `connectToDapp(accounts?)`,
`confirmSignature`, `rejectSignature`, `confirmTransaction({gas})`, `rejectTransaction`.

`WalletDefinition` gains `reject`, the symmetric counterpart to the existing `approve`. The popup is
already located generically by `findNotificationPopup`, so rejection is close to free.

### Home page

`launchWalletContext` currently opens the wallet's home page to unlock and then discards it
(`launch.ts:53`). Networks, accounts, and settings all need it. It is exposed as **`wallet.home`**,
not `wallet.page`: `page` already means "the dapp under test" in every spec, and the collision would
be a footgun.

### File layout

`wallets/metamask.ts` is ~120 lines and would blow past the 400-line limit once it carries network,
accounts, tokens, and settings. Helpers move to a folder of the same name, and the definition file
stays the import site, so the registry import never changes and there is no `index.ts` barrel.

```
src/wallets/metamask.ts        assembles the WalletDefinition
src/wallets/metamask/
  onboarding.ts                importWallet, reachUnlockScreen, unlock
  approve.ts                   approve/reject popup buttons
  actions/network.ts, accounts.ts, tokens.ts, settings.ts
```

Phantom follows the same shape when it grows; Slush stays a single file.

### The local chain

`confirmTransaction` cannot be verified without a transaction to confirm, and that needs a chain the
wallet can reach, an account funded to pay gas, and instant mining to assert against. A public
testnet is the wrong tool (faucet-funded accounts, 12s blocks, rate-limited RPCs), and mocking the
RPC does not work either: MetaMask queries the chain for balance, nonce, and gas estimates to render
the popup under test.

**Hardhat's node, not Anvil.** Synpress uses `@viem/anvil`, but that is only a wrapper around the
`anvil` binary, which means every contributor and CI job installs Foundry via `curl | bash` to run
the suite. Hardhat's node is plain npm: slower to boot (~1s vs instant) and a heavier dependency, but
no system binary and no extra CI step. Both default to the `test test … junk` mnemonic and pre-fund
account #0 as `0xf39F…92266`, the account `metamaskSetup` already uses.

It ships as a **subpath export** (`walletwright/hardhat`) with the chain dependency as an optional
peer, so installing walletwright to click a connect button doesn't drag in an EVM.

## Verification

Every action needs demo dapp surface to drive plus a real-extension run. The demo has connect and
sign only, so most of the work is dapp surface, not porting. Transactions and token permissions
cannot be verified without a local chain, which is what pulls one in at phase 2.

## PR sequence

Each is verified end-to-end before the next starts.

1. **Foundation**: capability model, `reject*`, `wallet.home`, MetaMask restructure.
2. **Transactions**: `walletwright/hardhat` (local chain), `confirmTransaction` with gas settings, demo tx section.
3. **Networks**: `addNetwork`, `switchNetwork`, and their approve/reject popups.
4. **Accounts, tokens, settings.**
5. **Wallet mock**: `walletwright/mock`, a headless injected-provider fake.

## Open questions

- MetaMask 13.35's gas UI shape is unknown until driven. Phase 2 may need to diverge from Synpress's
  `low|market|aggressive|site` preset vocabulary if the UI no longer offers those.
- Phantom's action coverage is likely a subset of MetaMask's. The capability model absorbs that, but
  the exact subset is discovered per action.
