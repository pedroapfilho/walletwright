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
  walletwright/        the library (npm: `walletwright`)
    src/index.ts         public API surface
    src/types.ts         WalletSetup, WalletDefinition, Wallet
    src/fixtures.ts      createWalletFixtures(), the Playwright test fixtures
    src/cli.ts           `walletwright cache` CLI
    src/wallets/         per-wallet definitions (metamask.ts, phantom.ts, rabby.ts, slush.ts, solflare.ts) + registry
    src/internal/        engine: cache (build), launch, controller, download, onboarding-patch, utils
  config-typescript/   @repo/typescript-config (tsconfig presets)
  config-vitest/        @repo/config-vitest (node vitest preset)
apps/
  demo/                Vite dapp + Playwright specs for MetaMask, Phantom, Rabby, and Slush (workspace:*)
  docs/                Fumadocs (Next 16) documentation site; content in apps/docs/content/docs
  landing/             Marketing landing page (Next 16 + Tailwind v4, neutral/ink theme, shiki)
```

## Dev workflow

Root scripts run turbo: `build`, `test`, `test:coverage`, `lint`, `typecheck`, `clean`, `dev`. Root
`test` runs only the walletwright unit suite.
Root-only: `format`/`format:check` (oxfmt), `test:e2e` (the demo's headed specs, via
`pnpm --filter demo`), `changeset`/`version-packages`/`release`.

Run the demo end-to-end from `apps/demo`: `pnpm exec playwright install chromium`, then
`pnpm test:cache` to onboard the wallets, then `pnpm test:e2e` to connect and sign. Run it headed
(see below). The network and transaction specs also need a local chain on `127.0.0.1:8545` (chain
id `31337`), e.g. Foundry's `anvil` seeded with the public test mnemonic.

## Architecture

A wallet-agnostic engine driven by per-wallet `WalletDefinition`s:

- `buildCache(setup)` (`internal/cache.ts`) launches with the extension, navigates to onboarding,
  runs `importWallet`, closes, then runs `finalizeCache` while the browser is closed.
- `launchWallet(setup)` (`internal/launch.ts`) copies the cache to a throwaway profile,
  launches headed with the extension, resolves the id, runs `reachUnlockScreen` then `unlock`, and
  returns a `Wallet`.
- `createWallet(...)` (`internal/controller.ts`) implements `connectToDapp`/`confirmSignature`/
  `approve` by finding the approval popup and clicking the wallet's confirm button.
- `wallets/{metamask,phantom,rabby,slush}.ts` hold the per-wallet definitions. A wallet with more than a
  file's worth of flow keeps its helpers in a folder of the same name, so the definition file stays
  the import site: `metamask.ts` assembles, `metamask/onboarding.ts` and `metamask/approve.ts` and
  `metamask/actions/*.ts` implement.

Beyond connect and sign, capabilities are **optional and per-wallet**. `WalletDefinition.actions`
groups them (`settings`, and later `network`/`accounts`/`tokens`), and `reject` is optional too. The
engine mirrors what a wallet declares onto `Wallet` and throws
`[walletwright] <wallet> does not support <action>()` for the rest. This keeps the registry honest:
`addNetwork` is meaningless for Slush (Sui), and a wallet only declares an action once it has been
driven end-to-end.

To add a wallet, implement a `WalletDefinition` in `src/wallets/` and register it in
`src/wallets/index.ts`. Each definition declares its `ecosystems` (`evm`/`svm`/`sui`/`dot`/`btc`), and
`walletKindsByEcosystem(eco)` lists the wallets that drive a chain.

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
app: popup, onboarding, unlock, and approvals all live in `index.html`. The parts that took real
debugging:

- Onboarding runs `#/Welcome` → "More options" → "Import existing from passphrase" → 12 inputs
  `input[placeholder="Word N"]` → "Next" → `#/CreatePassword` (`input[placeholder="Password"]` and
  `"Confirm Password"`) → "Next" → `#/OnboardingSecurity` → "Next" → wait for `#/tokens`, the home
  route. A `#/CreateWallet` spinner sits in between and must finish, or the wallet never persists.
- There is no separate `notification.html`. Approvals are `index.html` with `isPopup=1` in the URL,
  which is what `notificationMatch` keys on.
- The buttons aren't native, so they need `click({ force: true })`. The popup also reports its buttons
  visible about 2 seconds before its React handlers wire up, so `approve` sleeps first; an early click
  is a silent no-op.
- Connect confirms with "Approve". Signing confirms with "Sign" and then re-prompts for the password
  ("Unlock"), which is why `WalletDefinition.approve` takes the password.
- Gate clicks on `waitFor({ state: "visible" })`, never `isVisible({ timeout })`. `isVisible()` reads
  the current state and returns immediately (its `timeout` does not wait), so against Slush's
  late-mounting single-page UI it reads false and the click silently no-ops. That broke the cache
  build: the `More options` / `Import existing from passphrase` clicks were skipped and the flow never
  reached the seed screen, surfacing as a `Word 1` input timeout several screens later.
- **Its backend has to be stubbed, or nothing renders.** `api.slush.app` and `initialize.slush.app`
  answer an automated browser with a Cloudflare 403 whose body is the Mysten Labs marketing page (a
  plain `curl` gets the same, while Sui's own `fullnode.mainnet.sui.io` answers 200, so it is Slush's
  edge, not the network). Slush's GraphQL client throws `NonGraphQLResponseError` on that HTML and
  renders a "Reload App" screen instead of `#/Welcome`, which surfaces several screens later as a
  `Word 1` input timeout and looks exactly like a stale selector. `slush.ts` answers every
  `*.slush.app` request with `{"data":{}}` via `WalletDefinition.prepareContext`; onboarding,
  unlock, connect, and sign need nothing else from the API. Drop it once the endpoint answers again.
- **Headed only.** Opening `index.html?isPopup=1` in a tab (the trick that reaches approvals headless
  elsewhere) drops the query and lands on `#/tokens`, so there is no approval to drive.
- Verified end-to-end via `apps/demo` (the SUI section uses `@wallet-standard/app`, the spec is
  `tests/slush.spec.ts`).

### Solflare (SVM), verified

Solflare (`src/wallets/solflare.ts`) is a Web-Store build with no manifest `key` (path-derived id).
Onboarding lives in `wallet.html` under `#/onboard`; approvals get their own `confirm_popup.html`
window, which is what `notificationMatch` keys on. Worth knowing:

- The flow is "Import existing wallet" → "Recovery phrase" → twelve `input-recovery-phrase-N` boxes →
  `btn-continue` → `input-new-password` / `input-repeat-password` → `btn-continue` → **"No Active
  Wallets Found"** → `btn-quick-setup` → `btn-explore`. Solflare calls an account "active" only if it
  holds SOL, so an unfunded test seed always takes the quick-setup branch; skipping it leaves
  onboarding incomplete.
- Confirm buttons differ by request: connect uses `btn-connect`, signing uses `btn-approve`
  (cancels are `btn-cancel` / `btn-reject`), so `approve` unions the pair.
- Verified end-to-end via `apps/demo`, driving the name-agnostic Wallet-Standard Solana section
  (`#mockSvmConnect` / `#mockSvmSign`); the spec is `tests/solflare.spec.ts`.
- **Headed only.** Headless, the dapp gets `Connection rejected` about two seconds after the connect
  click, before any approval UI exists and whether or not the engine opens `confirm_popup.html`, so
  the rejection is Solflare's own. The spec pins itself with `test.use({ headless: false })`.

### Rabby (EVM), verified

Rabby (`src/wallets/rabby.ts`) is MV3 with no manifest `key`, so its id is path-derived like
MetaMask's, and its approvals use the standard `notification.html`. It is a hash-router SPA. What
cost real debugging:

- **Drive approvals with an in-page `evaluate` click, not `locator.click()`.** Rabby's approval
  window unmounts its contents seconds after losing focus, and Playwright's click (which waits for
  actionability, then for the click to settle) loses the window mid-action. Rabby reads the vanished
  window as a dismissal, so the dapp gets `User rejected the request` even though the button was
  visible and enabled. Rabby is a plain React app, so `evaluate` works (unlike MetaMask, item 12).
- **Signing is two steps.** "Sign" swaps itself for "Confirm", which must also be clicked, and both
  start disabled while Rabby analyses the request. Connect is one step ("Connect"). So click each
  distinct label once and treat the window closing as the only completion signal: re-clicking a
  still-open "Connect" re-issues the request and the dapp ends up with nothing.
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

1. **Headless needs the `chromium` channel and a `notificationPage`.** Two separate things. First,
   Playwright's default headless build is the headless _shell_, which cannot load an extension at
   all, so `launchPersistentContext` passes `channel: "chromium"` (the full browser) in both
   `internal/launch.ts` and `internal/cache.ts`. Second, **whether a headless approval window
   surfaces as a page is per-wallet, so probe before assuming**: MetaMask's is created (the request
   does reach the wallet) but never exposed, so `findNotificationPopup` polls forever, while
   Phantom's does surface. `awaitApproval` (`internal/utils.ts`) therefore watches both in one poll:
   the wallet's window, and the `notificationPage` it opens itself after a 5s grace, which reaches
   the very same pending approval. Searching one _then_ the other, each with its own slice of the
   budget, is what broke the first CI run: whichever route arrived outside its slice was missed and
   the dapp hung. Skipping the wallet's window entirely breaks Phantom the same way, from the other
   side. The engine closes only the page it opened itself (`Approval.owned`); closing a
   wallet-spawned window early can abort the request instead.
   **Readiness is per-route.** For the engine's own page it is "the wallet routed it away from the
   entry URL", because an idle `notification.html` renders a button of its own; for a spawned window
   a rendered button is enough, because the window only exists when a request is pending. Applying
   the stricter rule to both breaks Phantom, whose popup sits on that same entry URL.
   **Budgets are the CI story.** Routing was measured at up to 11s locally and far slower on a
   GitHub runner (roughly 4x on everything), so that path gets 60s even when the approval is
   optional, and MetaMask's confirm click gets 45s: the engine hands the popup over as soon as it
   renders _a_ button, which on that runner is well before the footer exists, and a 15s click budget
   missed every single approval. Give a wallet suite a Playwright `timeout` of 300s to match.
   **Verified headless on a developer machine: MetaMask (all 12 demo specs), Phantom, Rabby. On a
   GitHub-hosted runner only Phantom and Rabby hold up**: MetaMask surfaces no approval window there
   and the page the engine opens renders the wallet home instead of the request, so every approval
   times out. Raising budgets does not help, and was tried twice. This repo's own E2E gate therefore
   runs headed under `xvfb`, which covers all five wallets. Headed-only everywhere: Solflare (it
   answers a headless connect with "Connection rejected" in ~2s, before any approval UI exists, with
   or without the engine's tab) and Slush (opening `index.html?isPopup=1` in a tab drops the query
   and lands on `#/tokens`, the wallet home, so there is no approval to drive).
   A wallet without a `notificationPage` fails fast at `launchWallet` rather than 30s later at the
   first approval. `xvfb-run` is now the fallback for those two, not the documented default.
2. **Derive the extension id; don't query it.** `chrome://extensions` is blocked headless and the MV3
   service worker starts lazily, so `getExtensionId` would race. Compute it instead
   (`internal/utils.ts`, `extensionIdFromPath`): sha256 of the manifest's public `key` if present
   (Phantom uses its fixed Web Store id), otherwise of the absolute load path (MetaMask has no key),
   first 16 bytes mapped `0-f → a-p`.
3. **Navigate to the onboarding page; don't wait for it.** The extension's auto-opened tab is
   unreliable, especially headless. Call `goto(chrome-extension://<id>/<onboardingPage>)` and retry.
   Right after launch the URL fails with `ERR_BLOCKED_BY_CLIENT` until the extension registers.
4. **Poll for the popup; `waitForEvent('page')` misses it.** Approval popups open as `about:blank` and
   then navigate, so a URL predicate is false at creation. Poll `context.pages()` instead
   (`internal/utils.ts`, `findNotificationPopup`).
5. **MetaMask gets stuck on "wallet is ready".** After import, the "Open wallet" step goes through the
   MV3 service worker and hangs under automation, leaving `completedOnboarding=false`, so the cached
   wallet ignores dapp requests. The fix writes `completedOnboarding=true` straight into the leveldb
   (`internal/onboarding-patch.ts`, via `classic-level`) as MetaMask's `finalizeCache`.
6. **Phantom and Slush block the famous public test seed.** Phantom flags `test test … junk` as
   malicious and drops the connection. Use a fresh, unfunded mnemonic for both.
7. **Confirm-button selectors differ.** MetaMask: connect `confirm-btn`, sign `confirm-footer-button`
   (legacy `page-container-footer-next`). Phantom: `primary-button` (reject `secondary-button`).
   Slush: the text "Approve" or "Sign", then "Unlock" for the sign re-auth.
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
    sampling the popup too early sees an empty page, which is why `approve`/`reject` wait on the
    button rather than on the popup existing.
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
    scrolled to the bottom. Its buttons have no testids. MetaMask's `approve` handles it
    (`wallets/metamask/approve.ts`).
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
    (`internal/controller.ts`). Even then the MV3 worker can take 10s+ to spawn the popup, so
    required popups wait 30s, and `findNotificationPopup` returns a popup only once a button is
    visible, since the window opens as a bare shell and routes later.
21. **MetaMask renames the accounts of a shared SRP behind your back.** Its backup-and-sync restores
    account names keyed to the seed, and the public test seed is used by thousands, so on a network
    where that sync lands the wallet reports names like `dev1` and `personal` in place of
    `Account 2` and of whatever `accounts.rename` just set. It shows up as a naming assertion that
    passes locally and fails on CI, not as an error. `add, rename, and switch accounts` is excluded
    from the E2E gate for this; a real fix means stopping that sync for the test profile.

## Conventions

- TypeScript ESM, `.ts` import extensions, exports at the end of public modules, arrow functions,
  `type` over `interface`. Strict mode, zero TS/lint/format errors.
- Lint with oxlint (the `oxlint-config-awesomeness` preset), format with oxfmt. `oxlint.config.ts`
  turns off rules that don't fit a Node browser-driver: `no-await-in-loop` (the polling loops are
  intentional) and the React/Next/doctor presets (for example `rules-of-hooks` false-positives on
  Playwright's `use` fixture argument).
- Publishable package contract (mirror `packages/walletwright`): `exports`, `files: ["dist"]`,
  `publishConfig.access: public`, a tsdown ESM build with `dts`, `prepack`/`prepare` running the
  build, MIT.
- Build artifacts emit `.mjs`/`.d.mts`, so package.json `exports`/`bin`/`types` must match.
- Publishing goes through changesets; `@repo/*` configs stay `private`.
