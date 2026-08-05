# Plan 031: Headless wallet runs

> **Status**: EXECUTED 2026-08-05. Recorded after the fact, so the next executor inherits the
> measurements rather than re-deriving them.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MEDIUM (changes how every approval is reached)
- **Depends on**: none

## Why this mattered

The package was headed-only by construction (`internal/launch.ts` hardcoded `headless: false`) and
every doc said approval popups do not open headless, so CI needed `xvfb-run`. That was true of old
headless, which could not load extensions at all, and is no longer true.

## What is actually going on

Two separate obstacles, discovered by spike rather than by reading:

1. **Playwright's default headless build is the headless shell**, which cannot load an extension.
   Fixed by passing `channel: "chromium"` (the full browser) in `internal/launch.ts` and
   `internal/cache.ts`. Headed behaviour is unchanged, since that is the same Chromium build.
2. **MetaMask's approval window is created headless but never exposed as a page.** The request does
   reach the wallet: opening `notification.html` in a tab lands on `#/connect/<id>`, the same pending
   approval. So the engine opens the wallet's `notificationPage` when no window surfaces, and closes
   that page afterwards, since it does not close itself the way a popup does.

Measurements worth keeping:

- **Whether a headless approval window surfaces is per-wallet.** Phantom's does; MetaMask's does
  not. Generalising from MetaMask and skipping the 5s spawn probe made Phantom's very first connect
  hang, because its request stayed in a window nothing drove. Probe, then open.
- Close only the page the engine opened. A wallet-spawned window closes itself once the approval
  registers, and closing it earlier can read as a dismissal.
- Readiness of an engine-opened page is **"the URL left the entry"**, not "a button is visible": an
  idle `notification.html` renders a button of its own and would pass the naive check forever.
- The page took **up to 11s** to route on a cold MV3 worker, which is why its budget has a 30s floor
  (`APPROVAL_PAGE_MIN_TIMEOUT_MS`). The first attempt used the 10s optional budget and produced a
  hang that only passed on Playwright's retry.
- `page.evaluate` is still off-limits inside MetaMask (LavaMoat scuttling); `locator.isVisible()` is
  fine, `locator.allTextContents()` is not.

## Verified

| Wallet   | Headless | Evidence                                                                                                    |
| -------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| MetaMask | yes      | all 12 demo specs (connect/sign, accounts, actions, solana, network, transaction)                           |
| Phantom  | yes      | `phantom.spec.ts`, `phantom-actions.spec.ts`                                                                |
| Rabby    | yes      | `rabby.spec.ts`                                                                                             |
| Solflare | no       | dapp gets `Connection rejected` ~2s after the click, with or without the engine's tab; Solflare's own doing |
| Slush    | no       | `index.html?isPopup=1` in a tab drops the query and lands on `#/tokens`, so no approval to drive            |

Solflare and Slush declare no `notificationPage`, so `launchWallet` throws a named error rather than
hanging, and their specs pin `test.use({ headless: false })`.

## Slush's cache build, fixed in passing

It looked like a stale selector (`Word 1` timeout) and was not. `api.slush.app` answers an automated
browser with a Cloudflare 403 whose body is the Mysten Labs marketing page, so Slush's GraphQL client
throws `NonGraphQLResponseError` at boot and renders "Reload App" instead of `#/Welcome`. Every
selector in `slush.ts` was already correct. `WalletDefinition.prepareContext` (new, applied in both
`buildCache` and `launchWallet` before anything navigates) answers `*.slush.app` with `{"data":{}}`,
and the whole flow works again: cache build, unlock, connect, sign, reject.

Diagnostic worth keeping: `curl -X POST https://api.slush.app/graphql` gets the same 403 while
`fullnode.mainnet.sui.io` answers 200, which is how you tell a vendor edge block from a network
problem.

## Follow-ups

- Drop Slush's `prepareContext` stub once `api.slush.app` answers automated requests again.
- Solflare headless would need to be understood from Solflare's side (why the immediate rejection);
  nothing in the engine changes the outcome.
