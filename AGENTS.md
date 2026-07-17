# AGENTS.md

Guidance for AI coding agents (and humans) working in `walletwright`. `CLAUDE.md` is a symlink to
this file.

## What this repo is

`walletwright` is a **Playwright wallet-automation library** for **MetaMask (EVM)**, **Phantom
(EVM + Solana)**, and **Slush (Sui)**. It onboards a wallet from a seed, caches the profile, then
unlocks and drives the extension's connect/sign approval popups against a dapp under test.

walletwright takes the approach that works — onboard once, cache the profile, drive the popups — and
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
    src/wallets/         per-wallet definitions (metamask.ts, phantom.ts, slush.ts) + registry
    src/internal/        engine: cache (build), launch, controller, download, onboarding-patch, utils
  config-typescript/   @repo/typescript-config (tsconfig presets)
  config-vitest/        @repo/config-vitest (node vitest preset)
apps/
  demo/                Vite dapp + Playwright specs for MetaMask, Phantom, and Slush (workspace:*)
  docs/                Fumadocs (Next 16) documentation site; content in apps/docs/content/docs
  landing/             Marketing landing page (Next 16 + Tailwind v4, neutral/ink theme, shiki)
```

## Dev workflow

Root scripts run turbo: `build`, `test`, `test:coverage`, `lint`, `typecheck`, `clean`, `dev`.
Root-only: `format`/`format:check` (oxfmt), `changeset`/`version-packages`/`release`.

Run the demo end-to-end from `apps/demo`: `pnpm exec playwright install chromium`, then
`pnpm test:cache` to onboard the wallets, then `pnpm test` to connect and sign. Run it headed (see
below).

## Architecture

A wallet-agnostic engine driven by per-wallet `WalletDefinition`s:

- `buildCache(setup)` (`internal/cache.ts`) launches with the extension, navigates to onboarding,
  runs `importWallet`, closes, then runs `finalizeCache` while the browser is closed.
- `launchWalletContext(setup)` (`internal/launch.ts`) copies the cache to a throwaway profile,
  launches headed with the extension, resolves the id, runs `reachUnlockScreen` then `unlock`, and
  returns a `Wallet`.
- `createWallet(...)` (`internal/controller.ts`) implements `connectToDapp`/`confirmSignature`/
  `approve` by finding the approval popup and clicking the wallet's confirm button.
- `wallets/{metamask,phantom,slush}.ts` hold the per-wallet definitions. A wallet with more than a
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

| Ecosystem | Verified | Roadmap (next)                   |
| --------- | -------- | -------------------------------- |
| EVM       | MetaMask | Rabby, Coinbase Wallet           |
| SVM       | Phantom  | Solflare, Backpack               |
| SUI       | Slush    | Suiet, Nightly                   |
| DOT       | none yet | Talisman, SubWallet, Polkadot.js |
| BTC       | none yet | Xverse, UniSat, Leather          |

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
- Verified end-to-end via `apps/demo` (the SUI section uses `@wallet-standard/app`, the spec is
  `tests/slush.spec.ts`).

## Wallet automation: hard-won knowledge

Each item below cost real debugging time. Don't "simplify" them away.

1. **Run headed.** Extension connect/sign approval popups do not open in headless Chromium. CI needs a
   virtual display (`xvfb-run`). `buildCache` may run headless, since onboarding has no popups, but
   `launchWalletContext` and the tests must be headed.
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
