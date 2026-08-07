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

1. **Playwright's default headless build is the headless shell**, which cannot load an extension.
   Fixed by passing `channel: "chromium"` (the full browser) in `internal/launch.ts` and
   `internal/cache.ts`. Headed behaviour is unchanged, since that is the same Chromium build.
2. **Whether a wallet's approval window surfaces as a page headless is a property of that wallet.**
   Phantom's and Rabby's do; MetaMask's is created but never exposed. A wallet declares
   `headlessApprovals: true` once verified, and `launchWallet` refuses headless for the rest.

### The fallback that was tried, and removed

For a while the engine opened the wallet's approval URL itself when no window surfaced, which made
MetaMask work headless on a developer machine. It is gone. On a CI runner that same URL renders
MetaMask's **home screen**, buttons and all, so the engine drove the wrong page and stopped waiting
for the right one. Synpress never opens that URL either; it waits for the window the wallet opens.

The rule that came out of it: an approval you did not ask the wallet to open is not an approval.

Two pieces of that work survive, and both earn their place:

- `WalletDefinition.approvalControls` says which controls mean "a request is on screen", so a popup
  rendering home is not mistaken for one. A wallet without it falls back to "any button is visible",
  which is enough for a window that only ever opens for a request. The stricter test cannot be
  universal: Phantom's popup sits on the bare entry URL.
- `placeApprovalWindow` pins the popup to 360x592 and moves it to (50,50) over CDP. A window that
  opens partly off a small or virtual display renders fine but cannot be clicked, which reads as a
  button timeout rather than a layout problem. Synpress carries the same workaround, for the same
  reason.

Measurements worth keeping:

- The engine-opened page took up to 11s to route locally, and far longer on a GitHub runner, which is
  what drove several rounds of budget-raising before the page turned out to be the wrong one. Budgets
  were never the problem.
- `page.evaluate` is still off-limits inside MetaMask (LavaMoat scuttling); `locator.isVisible()` is
  fine, `locator.allTextContents()` is not.

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

## What the CI runner added

The suite passed locally and failed almost entirely on a GitHub runner, twice, for budget reasons
that a developer machine never reaches. Both fixes are budgets, and both were measured from a red
run rather than guessed:

- Reaching the approval: the search ran as two sequential slices (probe for a spawned window, then
  open the page), and MetaMask's page routed outside its slice. One poll now watches both routes for
  the whole 60s.
- Settling it: `metamask/approve.ts` clicked with a 15s budget, and every approval missed it. The
  engine hands a popup over as soon as it renders _a_ button, which on that runner is well before
  MetaMask renders its footer, so the click waits from too early a moment. Now 45s.

Rule of thumb from this: the runner is roughly 4x slower than a developer machine, and a budget that
has never been exercised near its limit locally is not evidence of anything.

Neither budget was enough, and the third round is what showed why. With the page snapshots uploaded
(added in round two, and worth every line), every MetaMask failure was waiting on **the wallet home
screen**: account header, Buy/Swap/Send, a news carousel. An idle `notification.html` does not stay
a bare shell on that runner, it renders home, so "the URL left the entry" accepted it. Readiness now
asks the wallet (`WalletDefinition.approvalControls`), and with that in place MetaMask reaches the
full 60s finding nothing at all: on a GitHub runner it surfaces no approval window and routes the
engine's page to home. So **MetaMask headless is a developer-machine capability, not a
GitHub-runner one**, and the E2E gate runs headed under `xvfb`, which covers all five wallets.

What cost the most time here was iterating against a 40-minute feedback loop on a machine I could not
reproduce. Two cheaper moves, in order: upload the artifacts _first_, and prefer the known-good
fallback (`xvfb`) over a third round of budget guessing.

## MetaMask on GitHub Actions

This is a known MetaMask issue, not a walletwright one. Synpress documents it: MetaMask "has known
compatibility issues with running in headless mode on certain CI providers, including GitHub
Actions", attributed to "a bug within MetaMask itself", and its recommended CI recipe wraps **both**
the cache build and the test run in `xvfb-run`.

That second half is the part worth writing down, because it is not obvious and cost a CI round: the
onboarding matters as much as the run. A profile onboarded headless on that runner stays broken, and
a later headed run from it reaches `notification.html` showing the wallet home rather than the
pending request. The gate therefore onboards under `xvfb` too.

## Where CI landed

21 of 22 specs, five wallets, headed under `xvfb`, in about 7 minutes. The one exclusion is
`MetaMask: connect and sign on Solana`: on a GitHub runner its approval popup renders the wallet
home with a **disabled** `confirm-btn`, so the snap-routed Solana request never binds to the window
it opened. It passes locally on every run, its sibling reject spec passes on CI, and every other
MetaMask spec passes on CI, which puts it in the same MetaMask-on-GitHub-Actions bucket as the
headless problem rather than anything walletwright drives.

## Follow-ups

- **MetaMask's account sync is cut off** (`prepareContext` aborts `user-storage.api.cx.metamask.io`),
  because it restores account names for whichever SRP the profile holds and the public test seed is
  shared: CI saw `dev1` and `personal` on an account with a real balance. It worked, and the run that
  followed showed `Account 1` again and went from 5 failures in 26m to 1 in 7.4m. Cutting the auth
  stack around it as well (`authentication`, `oidc`) was too broad and has been narrowed back.
- **MetaMask's Solana connect on a GitHub runner.** Its popup renders home with a disabled Connect
  footer. Worth checking whether the cached profile even has a Solana account on that hardware: it is
  derived through a snap after import, and `buildCache` may close the browser before that lands on a
  slow machine, which would leave the connect screen with nothing to select and its button disabled.
- Drop Slush's `prepareContext` stub once `api.slush.app` answers automated requests again.
- Solflare headless would need to be understood from Solflare's side (why the immediate rejection);
  nothing in the engine changes the outcome.
