# AGENTS.md

Guidance for AI coding agents (and humans) working in `walletwright`. `CLAUDE.md` is a symlink to
this file.

## What this repo is

`walletwright` is a **Playwright wallet-automation library** for **MetaMask (EVM + Solana)**,
**Phantom (EVM + Solana)**, **Rabby (EVM)**, **Solflare (Solana)**, and **Slush (Sui)**. It onboards a wallet from a seed, caches the profile, then
unlocks and drives the extension's connect/sign approval popups against a dapp under test.

walletwright takes the approach that works (onboard once, cache the profile, drive the popups) and
rebuilds it clean: plain `@playwright/test`, current wallet and Chromium versions, no fork and no
patched dependencies.

## Layout

```
packages/
  walletwright/        the library (npm: `@walletwright/core`)
    src/index.ts         public API surface
    src/engine.ts        buildCache(), launchWallet(): resolve the setup's wallet, run the engine
    src/types.ts         WalletSetup, WalletDefinition, Wallet
    src/fixtures.ts      createWalletFixtures(), the Playwright test fixtures
    src/cli.ts           `walletwright cache` CLI
    src/wallets/         per-wallet definitions (metamask.ts, phantom.ts, rabby.ts, slush.ts, solflare.ts) + registry
    src/internal/        engine: cache (build), launch, session, profile, extension, download,
                         unlock-screen, approval, controller; standin.ts + standin/ is the test-only
                         stand-in wallet the engine tests drive
  config-typescript/   @repo/typescript-config (tsconfig presets)
  config-vitest/        @repo/config-vitest (node vitest preset)
apps/
  demo/                Vite dapp + Playwright specs for MetaMask, Phantom, Rabby, and Slush (workspace:*)
  docs/                Fumadocs (Next 16) documentation site; content in apps/docs/content/docs
  landing/             Marketing landing page (Next 16 + Tailwind v4, neutral/ink theme, shiki)
```

## Dev workflow

Root scripts run turbo: `build`, `test`, `test:coverage`, `lint`, `typecheck`, `clean`, `dev`. Root
`test` runs only the walletwright suite: unit tests plus the engine tests, which drive a stand-in
wallet extension in headless Chromium (`pnpm --filter @walletwright/core exec playwright install
chromium` once; `test.yml` installs it on CI).
Root-only: `format`/`format:check` (oxfmt), `test:e2e` (the demo's headed specs, via
`pnpm --filter demo`), `changeset`/`version-packages`/`release`. `e2e.yml` runs the demo specs in
its `wallets` job and the docs app's instant-navigation suite (`pnpm --filter docs test:e2e`) in
its `docs` job.

Run the demo end-to-end from `apps/demo`: `pnpm exec playwright install chromium`, then
`pnpm test:cache` to onboard the wallets (or `pnpm test:cache slush` for one), then `pnpm test:e2e`
to connect and sign. `test:cache` derives its wallet list from `wallet-setup.ts`, and CI calls the
same script. Run it headed
(see below). The network and transaction specs also need a local chain on `127.0.0.1:8545` (chain
id `31337`), e.g. Foundry's `anvil` seeded with the public test mnemonic.

## Architecture

A wallet-agnostic engine driven by per-wallet `WalletDefinition`s:

- The public entry points (`buildCache` and `launchWallet` in `engine.ts`, `createWalletFixtures`)
  resolve the setup's `WalletKind` to its definition once and pass the definition down. Nothing
  under `internal/` reads the registry, so any definition can drive the engine, which is how the
  engine tests drive the stand-in.
- `build` (`internal/cache.ts`) navigates to onboarding, runs `importWallet`, closes, then runs
  `finalizeCache` and publishes the profile while the browser is closed.
- `launch` (`internal/launch.ts`) reaches the definition's `unlockScreen` on a copy of the cached
  profile, unlocks it (`internal/unlock-screen.ts`), and returns a `Wallet`.
- Both open Chromium through `openSession` (`internal/session.ts`): the extension on a throwaway
  profile directory (fresh staging for the build, a copy of the cache for the run) with
  `prepareContext` applied, so the build and the run cannot load the wallet differently. The session
  owns the context and the directory together and disposes both on every failure path; the build
  keeps its staging through `finalizeCache` and publish, the run removes its copy on close. Profile
  paths and atomic publish live in `internal/profile.ts`; the archive a setup runs (`source`, plus
  the refusal of `version` for Web Store wallets) in `internal/extension.ts`.
- `createApprovals(...)` (`internal/approval.ts`) owns every approval, from the window opening to
  it closing: it finds the window the wallet opened and places it, passes the wallet's declared
  `screens` (each at most once), re-authenticates through the shared unlock flow when the window
  asks for the password (`submitPassword` in `internal/unlock-screen.ts`, so the same "password
  field cleared" check as unlock), and clicks the request's controls until the window closes. It
  clicks each control label at most once (re-clicking re-issues the request in Rabby), and a window
  that closes after a click is the answer. One that closes before any click is the wallet replacing
  it, so the engine looks for the new one. Its budgets (30s to appear, 10s optional, 60s to answer,
  10s per click) live in one `BUDGETS` object there.
- `createWallet(...)` (`internal/controller.ts`) names each `Wallet` call and binds actions;
  `connectToDapp`/`confirmSignature`/`approve` and their reject counterparts forward to the
  approvals. Every public method goes through one naming helper and a step runner: the fixtures
  report each call as a boxed `test.step`, while `launchWallet` runs it directly.
- `wallets/{metamask,phantom,rabby,slush}.ts` hold the per-wallet definitions. A wallet with more than a
  file's worth of flow keeps its helpers in a folder of the same name, so the definition file stays
  the import site: `metamask.ts` assembles, `metamask/onboarding.ts` and `metamask/approve.ts` and
  `metamask/actions/*.ts` implement.
- Onboarding, `unlockScreen.submit`, and actions click the wallet's own UI through
  `clicksFor(wallet)` (`internal/click.ts`), which has two intents. `click` is a control the flow
  needs: it waits for it to show, clicks, and throws `[walletwright] <Wallet> never showed <control>`
  on timeout. `clickIfShown` is an interstitial a run may skip: absence within its budget resolves
  `false`, but a control that shows and then refuses the click throws. `force` and `settleMs` are
  options, and the budgets (30s required, 10s optional) live in that module. Approval clicks go
  through it too, unless the wallet declares the in-page click strategy (Rabby).

Beyond connect and sign, capabilities are **optional and per-wallet**. `WalletDefinition.actions`
groups them (`accounts`, `network`, `settings`, and later `tokens`). The engine mirrors what a wallet declares onto `Wallet` and throws
`[walletwright] <wallet> does not support <action>()` for the rest. This keeps the registry honest:
`addNetwork` is meaningless for Slush (Sui), and a wallet only declares an action once it has been
driven end-to-end.

To add a wallet, implement a `WalletDefinition` in `src/wallets/` and register it in
`src/wallets/index.ts`. Its download `source`, `unlockScreen`, and `approval` are declared data the
engine drives; onboarding is a function. `approval` names the window's URL token (`urlMatch`), its
`confirm` and `cancel` controls (every one the request can show, which is also how the engine tells
a request from the wallet's idle UI), how to click them (`click`: Playwright's click with an
optional `settleMs`, or `inPage`), any `screens` the wallet puts in front of the request, and
whether the window surfaces headless (`headless`). Each definition declares its `ecosystems`
(`evm`/`svm`/`sui`/`dot`/`btc`), and `walletKindsByEcosystem(eco)` lists the wallets that drive a
chain.

The engine tests (`internal/{cache,launch,approval}.test.ts`) run `build`, `launch`, and the
`Wallet` against a stand-in wallet, headless: a dependency-free MV3 extension in
`internal/standin/extension`, served by a local HTTP server as a `release` zip with its real sha256,
so it goes through the real download path. A local dapp page asks it for approval through its
content script, and each request names how the approval window behaves: `late` opens blank and
routes later (items 4 and 13), `idle` shows a home screen with no request controls before routing
(item 1), `respawn` closes mid-approval and reopens, `steps` signs with Sign and then Confirm and
answers `re-issued` if Sign is clicked twice (Rabby), `reauth` asks for the password after Approve
(Slush) while `refuse` never takes it, and `notice` covers the request until a declared screen
accepts it (item 17). `home.html?settle=reload` renders nothing until reloaded (item 10). Its
approval window surfaces as a page headless, so it declares `approval.headless`. Cover a new engine behaviour
by teaching the stand-in to reproduce it, not by stubbing Playwright.

## Supported wallets and roadmap

The target is the top 3 wallets per ecosystem. A wallet enters `WalletKind` and the registry only
once its **connect and sign are verified end-to-end**. Looking done is not enough; verifying it is
the whole point of walletwright. Everything else is roadmap.

| Ecosystem | Verified                    | Roadmap (next)                   |
| --------- | --------------------------- | -------------------------------- |
| EVM       | MetaMask, Rabby             | Coinbase Wallet, Trust Wallet    |
| SVM       | Phantom, MetaMask, Solflare | Backpack, Glow                   |
| SUI       | Slush                       | Suiet, Nightly                   |
| DOT       | none yet                    | Talisman, SubWallet, Polkadot.js |
| BTC       | none yet                    | Xverse, UniSat, Leather          |

Adding a wallet is empirical: drive the real extension, never guess selectors. Download the CRX,
launch it headed, and snapshot each onboarding screen (its buttons, testids, and inputs) to discover
the real flow. Verifying connect/sign also needs a dapp section for that ecosystem. The demo has EVM,
SVM, and SUI today, with SUI wired through `@wallet-standard/app`. DOT will need `window.injectedWeb3`,
and BTC has no standard, so each Bitcoin wallet injects its own provider.

### Slush (SUI), verified

Slush (`src/wallets/slush.ts`) resolves its id via the path (no manifest key). It is a single-page
app: popup, onboarding, unlock, and approvals all live in `index.html`. Verified against 26.21.1, the
Web Store build current in October 2026. The parts that took real debugging:

- **Its accounts live on Slush's backend.** The wallet's accounts and dapp connections are records
  in Slush's GraphQL API (`api.slush.app`, Relay persisted queries) owned by an anonymous device
  session. The device keeps only that session (`anonymous-session-token`), the encrypted passphrase
  (`mnemonic__<id>`) and `password_hash`, all in the `keyval` store of the `keyval-store` IndexedDB
  (`signaldb-accounts` stays empty). `walletPersisted` waits for those keys before the cache is
  published.
- **So nothing is stubbed: the run needs the real backend.** `api.slush.app` and
  `initialize.slush.app` answer Playwright's Chromium with 200. Only a non-browser client such as
  `curl` gets Cloudflare's 403 (the Mysten Labs marketing page), with or without a browser
  User-Agent, so a `curl` 403 says nothing about the browser. Answering `*.slush.app` with
  `{"data":{}}` renders "Unexpected Error: Relay: Missing expected data at path
  'deviceSessionInvalid' in 'navigationQuery'" and "Reload App" in place of `#/GetStarted`, and no
  stub can stand in for the account and connection records.
- **Every run from one cache shares that session**, and copying the profile does not reset what the
  backend holds. A site connected once stays connected, so later connects return the account with
  no popup, which is why `tests/slush.spec.ts` connects with `connectToDapp({ optional: true })`. A
  new cache build is a new session.
- Onboarding runs `#/GetStarted` → "Get started" → `#/SendOTP` (phone or email sign-in) → "Skip" →
  "Maybe later" in the bottom sheet → `#/CreateAccount` → "Passphrase" (expands its row) → that row's
  "Import" link (`a[href$="#/ImportPassphrase"]`) → twelve inputs labelled `Word N` → "Import" →
  `#/CreatePassword` (placeholders `Password` and `Re-enter password`) → "Next" →
  `#/RequirePassword` → "Dive into Slush" → `#/tokens`, the home route.
- **Expand the Passphrase row before clicking its Import link.** Playwright reports the link visible
  while the row is still collapsed, so a forced click lands on the row and nothing happens, which
  surfaces as a `Word 1` timeout. The link click is unforced, so it waits for the open row.
- The welcome controls render before their handlers are wired, so those clicks are forced and
  settle first; an early click is a silent no-op. "Import", "Next", "Dive into Slush" and "Unlock"
  are native buttons that stay disabled until their inputs register, so they are clicked unforced,
  which waits for them to enable; a forced click fires at the disabled button.
- **Unlock.** A launch within `autoLockTime` (60 minutes by default) of the build comes back
  unlocked on `#/tokens`. Later, an alarm sets `walletLocked` and a lock form (`Password` field,
  "Unlock") renders over `#/tokens`, so the hash alone does not mean unlocked. The form mounts before
  the hash reaches `#/tokens`, and the unlock flow checks for the password field before
  `isUnlocked`. The form slides in and its button stays disabled until the password registers, hence
  the unforced click.
- There is no separate `notification.html`. Approvals are `index.html#approve-connection?…&isPopup=1`
  and `index.html#sign-personal-message?…&isPopup=1`, so `approval.urlMatch` keys on `isPopup=1`.
  The window opens blank and renders its request about 2 seconds later; the engine takes it once
  Approve, Sign, or Reject shows. They are native buttons, clicked unforced after the approval's
  2-second `settleMs`, kept because an early click on a Slush control is a silent no-op.
- Connect confirms with "Approve" (aria-label "Approve Connection"; its "Reject" carries
  `data-testid="reject-connection-button"`). Signing confirms with "Sign" or cancels with "Reject".
  Onboarding leaves "Confirm transactions" off, so signing does not re-prompt for the password; the
  approval engine still answers a password prompt through the shared unlock flow if one shows.
- Gate clicks on `waitFor({ state: "visible" })`, never `isVisible({ timeout })`. `isVisible()` reads
  the current state and returns immediately (its `timeout` does not wait), so against Slush's
  late-mounting single-page UI it reads false and the click silently no-ops, surfacing as a `Word 1`
  input timeout several screens later. `internal/click.ts` gates every wallet's onboarding and
  unlock clicks this way. The approval engine reads instantly too, but inside a poll over the
  window, so a late mount is read on a later pass.
- **Headed only.** Opening `index.html?isPopup=1` in a tab (the trick that reaches approvals headless
  elsewhere) drops the query and lands on `#/tokens`, so there is no approval to drive.
- Verified end-to-end via `apps/demo` (the SUI section uses `@wallet-standard/app`, the spec is
  `tests/slush.spec.ts`).

### Solflare (SVM), verified

Solflare (`src/wallets/solflare.ts`) is a Web-Store build with no manifest `key` (path-derived id).
Onboarding lives in `wallet.html` under `#/onboard`; approvals get their own `confirm_popup.html`
window, which is what `approval.urlMatch` keys on. Worth knowing:

- The flow is "Import existing wallet" → "Recovery phrase" → twelve `input-recovery-phrase-N` boxes →
  `btn-continue` → `input-new-password` / `input-repeat-password` → `btn-continue` → **"No Active
  Wallets Found"** → `btn-quick-setup` → `btn-explore`. Solflare calls an account "active" only if it
  holds SOL, so an unfunded test seed always takes the quick-setup branch; skipping it leaves
  onboarding incomplete.
- Confirm buttons differ by request: connect uses `btn-connect`, signing uses `btn-approve`
  (cancels are `btn-cancel` / `btn-reject`), so `approval.confirm` and `approval.cancel` union each
  pair.
- Verified end-to-end via `apps/demo`, driving the name-agnostic Wallet-Standard Solana section
  (`#mockSvmConnect` / `#mockSvmSign`); the spec is `tests/solflare.spec.ts`.
- **Headed only.** Headless, the dapp gets `Connection rejected` about two seconds after the connect
  click, before any approval UI exists and whether or not the engine opens `confirm_popup.html`, so
  the rejection is Solflare's own. It does not declare `approval.headless`, so the fixtures always
  launch it headed.

### Rabby (EVM), verified

Rabby (`src/wallets/rabby.ts`) is MV3 with no manifest `key`, so its id is path-derived like
MetaMask's, and its approvals use the standard `notification.html`. It is a hash-router SPA. What
cost real debugging:

- **Drive approvals with an in-page `evaluate` click, not `locator.click()`.** Rabby's approval
  window unmounts its contents seconds after losing focus, and Playwright's click (which waits for
  actionability, then for the click to settle) loses the window mid-action. Rabby reads the vanished
  window as a dismissal, so the dapp gets `User rejected the request` even though the button was
  visible and enabled. Rabby is a plain React app, so `evaluate` works (unlike MetaMask, item 12);
  its approval declares `click: { kind: "inPage" }`.
- **Signing is two steps.** "Sign" swaps itself for "Confirm", which must also be clicked, and both
  start disabled while Rabby analyses the request. Connect is one step ("Connect"). So the approval
  engine clicks each distinct label once and treats the window closing as the only completion
  signal: re-clicking a still-open "Connect" re-issues the request and the dapp ends up with nothing.
- **Onboard through `index.html#/new-user/guide`.** Plain `index.html` lands on a marketing carousel
  whose "Get Started" leads to an add-address menu that reopens the new-user route in a _second tab_.
  The flow is: "I already have an address" → "Seed Phrase or Private Key" → `#/new-user/import/
seed-or-key` → `#/new-user/import/seed-phrase/set-password` → `#/new-user/success`. The success
  screen persists the keyring; "Open Wallet" is not needed.
- **Anchor each onboarding step on its route, and poll for it.** `waitForURL` never settles on a hash
  router (a hash change fires no navigation event). It matters because screens share the
  `input[type="password"]` selector: the seed screen has twelve of them, so reading `nth(1)` as the
  password-confirm field on the seed screen silently overwrites word 2.
- **Fill the seed by pasting into the first box.** The twelve word boxes are unlabelled
  `type=password` inputs that re-render as they fill, so filling them one by one drops words. Rabby
  splits a pasted phrase across every box. Keep a per-box fallback for when clipboard access is
  denied.
- Verified end-to-end via `apps/demo` (EVM section, `tests/rabby.spec.ts`), including a cold run that
  re-downloads the CRX and re-onboards.

## Wallet automation: hard-won knowledge

Each item below cost real debugging time. Don't "simplify" them away.

1. **Headless is per-wallet, and the engine never opens an approval itself.** Two things. First,
   Playwright's default headless build is the headless _shell_, which cannot load an extension at
   all, so `openSession` (`internal/session.ts`) passes `channel: "chromium"` (the full
   browser) for both the build and the run. Second, **whether a wallet's approval window surfaces
   as a page headless is a property of that wallet**: Phantom's and Rabby's do, MetaMask's is
   created but never exposed. So a wallet declares `approval.headless: true` once verified, and
   `launchWallet` refuses headless for the rest rather than hanging at the first approval.
   The fixtures instead launch with `headless && approval.headless`, so a suite runs on Playwright's
   default `headless: true`. They cannot just change the built-in option's default: Playwright
   re-applies the config's `use` only after a fixture list that declares the key `{ option: true }`,
   and its types forbid `option` when overriding a built-in, so a plain override silently beats the
   user's config and `--headed`.
   An earlier version had the engine open the wallet's approval URL in a tab when no window
   surfaced, which did work for MetaMask on a developer machine. It is gone, and the reason is worth
   keeping: on a CI runner that same URL renders MetaMask's **home screen**, buttons and all, so the
   engine drove the wrong page and stopped waiting for the right one. Synpress never opens that URL
   either; it waits for the window the wallet opens. An approval you did not ask the wallet to open
   is not an approval.
   **Two things do have to be defended.** The engine takes a window only once one of the wallet's
   `approval.confirm` or `approval.cancel` controls (or a password prompt) shows, because MetaMask's
   popup can render home, buttons and all; Phantom's popup sits on the bare entry URL, so no
   URL-based test works for it either.
   And `placeApprovalWindow` pins the popup to 360x592 and moves it to (50,50) over CDP, because a
   window that opens partly off a small or virtual display renders fine but cannot be clicked, which
   reads as a button timeout rather than a layout problem. Synpress carries the same workaround.
   **CI runs under `xvfb`, for both the cache build and the run.** MetaMask has a documented
   headless-on-GitHub-Actions bug, and a profile onboarded headless there stays broken: a later
   headed run from it still lands on home. Give the display a real size (`-screen 0 1920x1080x24`)
   and the suite a Playwright `timeout` of 300s.
2. **Derive the extension id; don't query it.** `chrome://extensions` is blocked headless and the MV3
   service worker starts lazily, so `getExtensionId` would race. Compute it instead
   (`internal/extension.ts`, `extensionIdFromPath`): sha256 of the manifest's public `key` if present
   (Phantom uses its fixed Web Store id), otherwise of the absolute load path (MetaMask has no key),
   first 16 bytes mapped `0-f → a-p`.
3. **Navigate to the onboarding page; don't wait for it.** The extension's auto-opened tab is
   unreliable, especially headless. Call `goto(chrome-extension://<id>/<onboardingPage>)` and retry.
   Right after launch the URL fails with `ERR_BLOCKED_BY_CLIENT` until the extension registers.
4. **Poll for the popup; `waitForEvent('page')` misses it.** Approval popups open as `about:blank` and
   then navigate, so a URL predicate is false at creation. Poll `context.pages()` instead
   (`internal/approval.ts`, `acquire`).
5. **MetaMask gets stuck on "wallet is ready".** After import, the "Open wallet" step goes through the
   MV3 service worker and hangs under automation, leaving `completedOnboarding=false`, so the cached
   wallet ignores dapp requests. The fix writes `completedOnboarding=true` straight into the leveldb
   (`wallets/metamask/onboarding-patch.ts`, via `classic-level`) as MetaMask's `finalizeCache`.
6. **Phantom and Slush block the famous public test seed.** Phantom flags `test test … junk` as
   malicious and drops the connection. Use a fresh, unfunded mnemonic for both.
7. **Confirm-button selectors differ.** MetaMask: connect `confirm-btn`, sign `confirm-footer-button`
   (legacy `page-container-footer-next`). Phantom: `primary-button` (reject `secondary-button`).
   Slush: the text "Approve" or "Sign" (and "Unlock" if it re-prompts for the password).
8. **Extract with `adm-zip`, not `extract-zip`.** `extract-zip` mangled the MetaMask ZIP, pulling 2 of
   852 files. The `PK` ZIP signature for stripping CRX headers is a decimal byte array (`[80,75,3,4]`)
   to dodge the conflict between oxfmt lowercasing hex and `number-literal-case` wanting uppercase.
9. **`connectToDapp` tolerates a missing popup.** Phantom auto-approves an already-trusted site on a
   second chain (no popup), so connect is optional; `confirmSignature` requires a popup.
10. **MV3 service workers are flaky.** Cache-reload plus unlock can be timing-sensitive, so tests
    should set Playwright `retries`. Reaching the unlock screen reloads patiently before failing.
11. **Resolve symlinks for the path-derived id.** Chrome hashes the extension's real path, so
    `extensionIdFromPath` runs `realpathSync` first. Without it, a cache under a symlinked dir (macOS
    `/tmp` → `/private/tmp`) yields the wrong id and every navigation hits `ERR_BLOCKED_BY_CLIENT`.
12. **You can't `page.evaluate()` inside MetaMask.** It runs LavaMoat in scuttling mode, so
    `evaluate` dies with `property "setInterval" of globalThis is inaccessible under scuttling mode`.
    Read its UI with locators. This applies to the wallet's own pages, not to the dapp.
13. **MetaMask's approval popup opens before it renders.** The window appears at bare
    `notification.html` (no route hash, zero buttons) and only later routes to the request. Anything
    sampling the popup too early sees an empty page, which is why the approval engine waits on the
    wallet's confirm or cancel control rather than on the popup existing.
14. **Wallets reject with an EIP-1193 error object, not an `Error`.** A rejected request rejects the
    provider promise with `{ code: 4001, message }`, so a dapp doing `String(error)` renders
    `[object Object]`. The demo reads `error.message` explicitly (`apps/demo/src/main.ts`).
15. **MetaMask 13.x has no wallet-side network switch.** The active chain is scoped per dapp. The
    header's network manager (`sort-by-networks`) is an asset filter plus registry: selecting a
    network there does not change any dapp's chain, and neither does toggling the site's permitted
    networks in `#/permissions` (both verified empirically; the dapp's `eth_chainId` stays put).
    Custom networks are added under the manager's "Custom" tab; the RPC must be live, since
    MetaMask validates it before saving. The old `#/connections` route hard-errors;
    `#/permissions` is the connections page now.
16. **Switch chains with `wallet_addEthereumChain`, not bare EIP-3326.** A
    `wallet_switchEthereumChain` request for a wallet-added custom chain hangs: no popup, no error,
    the promise just never settles. `wallet_addEthereumChain` is idempotent (adds when missing,
    switches when present) and confirms both in one popup.
17. **A Snap "Third-party software notice" can cover the confirm.** The first custom-chain request
    routed through a protocol Snap opens a terms modal over the popup's footer; every confirm click
    is intercepted until it is accepted, and its Accept button is disabled until the notice is
    scrolled to the bottom. Its buttons have no testids. MetaMask declares it as an approval screen
    (`thirdPartyNotice` in `wallets/metamask/approve.ts`), which the engine passes before clicking.
18. **Gas presets don't render on a legacy-fee local chain.** The transaction popup's gas editor
    (`edit-gas-fee-icon` → `gas-fee-estimates-modal`) offers only `gas-option-gasPrice` ("Network
    suggested") and `gas-option-advanced` against anvil. Synpress-style low/market/aggressive
    presets (`gas-option-<key>`) need EIP-1559 fee history to appear, so `confirmTransaction`
    ships without a gas argument until those can be driven for real.
19. **The account menu is a popover with no close button.** Open it with `account-menu-icon`; to
    leave, navigate home (`goto(#/)`). `add-multichain-account-button` derives the next HD account
    with no dialog; per-account actions hang off `multichain-account-cell-end-accessory` →
    `multichain-account-menu-item-{rename,accountDetails,…}`. Import-from-key is `add-wallet` →
    `choose-wallet-type-import-account`, and a successful import returns to the wallet-type chooser,
    not home, so wait for the confirm button to disappear rather than for the home screen.
20. **After driving the wallet's own UI, popups spawn late and the extension tab steals them.**
    While an extension page is the active tab, MetaMask renders new approvals inline there instead
    of opening `notification.html`, so the action binder re-fronts the dapp when an action ends
    (`internal/controller.ts`), and every approval re-fronts it before looking for the window
    (`frontDapp` in `internal/approval.ts`). Even then the MV3 worker can take 10s+ to spawn the
    popup, so required popups wait 30s, and the engine takes a popup only once a request control is
    visible, since the window opens as a bare shell and routes later.
21. **MetaMask can render a connect page before it enables the requested network.** Seen with the
    Solana connect, roughly one run in three on a developer machine and more on a runner: the popup
    routes to `#/connect/<id>` and shows the right account, but Permissions → "Use your enabled
    networks" lists nothing, so Connect stays disabled and the page never recomputes (the failure
    snapshot showing the wallet home was the `home` tab, not the popup). The request is still
    pending in the background, so reloading the popup renders it from current state with the network
    in place. MetaMask declares that as an approval screen the engine passes at most once, on the
    connect route only, reloading after Connect stays disabled for 3s (`staleConnectPage`). Its
    Edit-networks dialog lists every network
    unchecked in that state, so picking one would mean guessing what the dapp asked for.
22. **MetaMask renames the accounts of a shared SRP behind your back.** Its backup-and-sync restores
    account names keyed to the seed, and the public test seed is used by thousands, so on a network
    where that sync lands the wallet reports names like `dev1` and `personal` in place of
    `Account 2` and of whatever `accounts.rename` just set, on an account holding a real balance. It
    shows up as a naming assertion that passes locally and fails on CI, not as an error. `metamask.ts`
    therefore aborts `user-storage.api.cx.metamask.io` via `prepareContext`, which is what MetaMask's
    own e2e suite does to its external services. Just that host: cutting the auth stack around it
    (`authentication`, `oidc`) reaches further than intended, since other features authenticate
    through it and a wallet that cannot authenticate can leave a confirm button disabled with
    nothing on screen to explain it.
23. **A boxed step reports at the caller of the function that awaits `test.step`.** Playwright
    builds a boxed step's location from the async stack at `test.step`, drops Playwright's own
    frames, then drops one more. So the controller's `named` wrapper is `async` and awaits the step
    runner itself, and the fixtures' `reportAsStep` is a plain pass-through. Returning the promise
    unawaited left the boxed stack empty (no location at all); an extra awaiting layer puts the
    location inside this package. Either way the failure loses its code frame at the spec line.
    There is no public way to register a library's frames as internal (`setBoxedStackPrefixes` is
    Playwright-only).

## Conventions

- TypeScript ESM, extensionless relative imports, exports at the end of public modules, arrow
  functions, `type` over `interface`. Strict mode, zero TS/lint/format errors.
- Lint with oxlint (the `oxlint-config-awesomeness` preset), format with oxfmt. `oxlint.config.ts`
  turns off rules that don't fit a Node browser-driver: `no-await-in-loop` (the polling loops are
  intentional) and the React/Next/doctor presets (for example `rules-of-hooks` false-positives on
  Playwright's `use` fixture argument).
- Publishable package contract (mirror `packages/walletwright`): `exports`, `files: ["dist"]`,
  `publishConfig.access: public`, a tsdown ESM build with `dts`, `prepack`/`prepare` running the
  build, MIT.
- Build artifacts emit `.mjs`/`.d.mts`, so package.json `exports`/`bin`/`types` must match.
- Publishing goes through changesets; `@repo/*` configs stay `private`.
- `apps/docs/turbo.json` and `apps/landing/turbo.json` disable Turbo caching for the Next builds.
  Next.js file traces (`.nft.json`) record pnpm paths such as `node_modules/.pnpm/node_modules/...`
  that differ between dependency installs, so a Vercel build that restores cached traces fails
  packaging with ENOENT. Every Next app that deploys retraces against the current install; the demo
  and package builds stay cached.

## Design-system linting

Run `pnpm lint` after changes and fix every error. `oxlint.config.ts` registers `@shadcn/lint` and enforces all six rules as errors: component contracts, known Tailwind classes, static component class names, semantic colors, theme or scale values, and class-based styling. Use CSS custom properties for runtime geometry and named theme tokens for custom values. Use component variants for appearance and layout classes at call sites. All six rules also apply inside primitive directories. Shared styles belong to component variants or the owning stylesheet. Keep theme discovery local to each app. Exact class-merging fixture allowances apply only to the named test files.

## Upstream UI components

Keep registry modules in `apps/docs/components/ui` aligned with the configured shadcn Base UI APIs. Preserve branding in semantic theme tokens, load `shadcn/tailwind.css`, and place product compositions outside the primitive directory. Run `pnpm check:shadcn` along with the normal validation suite; read `apps/docs/SHADCN.md` before updating the reviewed source lock.
