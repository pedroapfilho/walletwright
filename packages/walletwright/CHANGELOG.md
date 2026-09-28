# @walletwright/core

## 0.5.0

### Minor Changes

- 8eeeb62: Make the fixtures work on Playwright's defaults, report every wallet call as a step, and make the public surface promise only what the engine does.

  **The fixtures pick headless per wallet.** `createWalletFixtures` passed Playwright's `headless` straight through, and Playwright defaults it to `true`, so a MetaMask, Solflare, or Slush suite written from the getting-started guide threw at launch until the config set `headless: false`. The fixtures now launch headless only where the wallet declares support (Phantom, Rabby) and open a real window for the rest, so no `headless` setting is needed. `launchWallet` keeps its strict behaviour and still refuses headless for those wallets by name.

  **Wallet calls are Playwright steps.** Each call (`wallet.connectToDapp`, `wallet.accounts.add`, …) is reported as a boxed `test.step` under its own name in the report and trace, and a failing call now shows a code frame at the spec line that made it rather than at the engine. The launch shows up as `launch <Wallet>`.

  **`launchWallet` supports `await using`.** `LaunchedWallet` implements `Symbol.asyncDispose`, so `await using launched = await launchWallet(setup)` closes the browser and removes the throwaway profile on scope exit, even when the code throws.

  **The CLI reads the setup file the docs show.** `walletwright cache --setup <file>` builds every `WalletSetup` the module exports, named or default, one after another, instead of requiring a default export. `--wallet` narrows it to one wallet's setups. A setup-shaped export that fails validation is reported by name; the list of valid wallets now comes from the registry.

  **MetaMask's Solana connect no longer flakes.** MetaMask could render the connect page before it had enabled the Solana network, leaving Connect disabled for good, so `connectToDapp()` timed out in roughly one run in three. The request is still pending when that happens, so MetaMask's `approve` now reloads a connect page whose Connect stays disabled, and the page renders again with the network in place.

  **Breaking:**

  - `WalletSetup.version` is refused for Phantom, Rabby, Solflare, and Slush. They run their Chrome Web Store build, which cannot be pinned; `version` was silently ignored for the download while still forking the profile cache.
  - `wallet.network.switch` is removed. No wallet implemented it, so it could only throw; switching is dapp-initiated through `wallet_addEthereumChain` and `wallet.approve()`.
  - `WalletDefinition` replaces `prepareExtension`, `reachUnlockScreen`, and `unlock` with declarative `source` and `unlockScreen` fields, and `WalletActionContext` gains `unlock()`. This only affects code that reads the definitions in `wallets`; a setup can only name a built-in wallet.

  `walletKinds` and the `NetworkConfig` type are now exported.

## 0.4.0

### Minor Changes

- 2113ac7: `connectToDapp` now accepts `{ optional: true }` and waits for a required popup by default. A site the wallet already trusts connects without one; passing the flag keeps the short wait and resolves quietly, while the default flags a missing popup instead of silently succeeding.

## 0.3.1

### Patch Changes

- 28c935f: Fix the Slush onboarding gate, which could never pass. It waited for `dataLayerMigrated`/`dataLayerMigrationStartedAt` on the preferences row, and current Slush (26.18.1) writes neither field, so every cache build failed after 60s regardless of the timeout. The gate now waits for what the cache actually needs: an account in `signaldb-accounts` and a preferences row whose `currentAccountId` selects it.

## 0.3.0

### Minor Changes

- fdb91d4: Fix a set of state-representation defects found by a repo-wide simplification audit.

  **Caches now publish from staging.** Extension extraction and the onboarded profile build both wrote
  in place, so an interrupted run (Ctrl-C, ENOSPC, a CI timeout, a flaky MV3 worker) could leave a
  partial directory that still satisfied the "does it exist" check every later run made. That surfaced
  much later as an unlock or selector timeout rather than as a build failure. Both now build inside the
  cache and publish by rename. Profile replacement keeps the prior cache at a recovery path until the
  new one lands, so a failed or interrupted publication can restore it.

  **`launchWallet` no longer leaks its throwaway profile copy.** Cleanup was bound to the browser
  context's `close` event, which does not exist yet if the profile copy or the launch itself fails, and
  which nobody awaited. `launchWallet` now returns `close()` alongside `context` and `wallet`: it closes
  the browser and then awaits removal of the copy. `context.close()` still triggers a best-effort
  cleanup, so existing code keeps working, but `close()` is the documented path.

  **Approval handling is more precise.** A popup respawned mid-approval is now positioned on screen like
  the first one (it previously skipped that, and an off-screen window renders fine but refuses clicks).
  The "did it close" check now tracks the exact page it drove instead of scanning the context for any
  matching URL, which reported failure whenever a wallet chained a second popup or left a notification
  window on its home screen. That check also now applies to `connectToDapp()`, which could previously
  report success on a popup that never closed. MetaMask's `reject` gained the third-party-notice
  dismissal and retry that `approve` already had, since the notice covers the whole footer.

  **The `cache` CLI validates its flags.** It now uses `node:util`'s `parseArgs` in strict mode, so an
  unknown flag, a flag missing its value, `--headless false` (which used to turn headless _on_), and
  `--wallet=value` are all handled correctly instead of silently ignored or inverted. `--setup` combined
  with a flag it would discard is now an error. Failures set `process.exitCode` rather than calling
  `process.exit`, which could truncate the error message when stderr was piped.

  **The mocks give each install its own bridge.** Installing `installMockWallet` or
  `installMockStandardWallet` twice with different options used to discard the second handler while
  returning its address, so the page signed with the first install's key on the first install's chain.

  **Breaking (types only):** `WalletDefinition.reject` is now required. Every wallet in the registry
  already declares it, and the public `Wallet` type has always promised rejection unconditionally, so
  this only affects external code that annotates a `WalletDefinition` literal by hand. `isWalletKind` is
  now exported.

## 0.2.1

### Patch Changes

- 159f35d: Move the MetaMask onboarding patch to classic-level 3. A missing key no longer rejects with
  `LEVEL_NOT_FOUND`; it resolves `undefined`, so the reads that probed for the `OnboardingController`
  and `data` keys no longer swallow every error with a `.catch()`. A read that fails for a real reason
  (a corrupt or locked profile database) now surfaces instead of being reported as "MetaMask persisted
  no onboarding state". Both persisted state shapes and both failure paths are covered by tests.

## 0.2.0

### Minor Changes

- 25a0f0b: Run wallet suites headless. `launchWallet` takes `{ headless }` and `createWalletFixtures` passes
  Playwright's own `headless` option through, so `--headed` and `use: { headless }` now reach the
  wallet's browser. Headless launches the `chromium` channel, because Playwright's default headless
  build is the headless shell, which cannot load an extension at all.

  Whether it then works is per wallet, and a wallet says so with the new
  `WalletDefinition.headlessApprovals`: Phantom's and Rabby's approval windows surface as pages
  headless, MetaMask's is created but never exposed, and Solflare rejects a headless connect outright.
  `launchWallet` throws a named error for a wallet that has not declared it, rather than hanging at
  the first approval.

  Two smaller changes go with it. `WalletDefinition.approvalControls` lets a wallet say which controls
  mean "a request is on screen", so a popup that renders the wallet's home screen is not mistaken for
  an approval; MetaMask declares it. And an approval window is now pinned to 360x592 and moved on
  screen over CDP before it is clicked, because a popup that opens partly off a small or virtual
  display renders fine but cannot be clicked.

### Patch Changes

- b84bd5a: Declare each wallet capability once. `AccountActions`, `NetworkActions` and `SettingsActions` are now
  derived from the matching `AccountsApi`, `NetworkApi` and `SettingsApi` types on `Wallet`, so a
  capability's name and argument list are written in a single place and the controller stops compiling
  until a new one is bound. Published types are unchanged: the derived aliases resolve to exactly the
  shapes they replaced.
- a7f7a51: Fix the `walletwright` CLI doing nothing when run from an installed package.

  The entry guard compared `import.meta.url` against a raw `process.argv[1]`. Node resolves the
  former through symlinks and leaves the latter alone, so every invocation through
  `node_modules/.bin/walletwright` (a symlink under any pnpm install) compared unequal, skipped
  `main()`, and exited 0 without output. The guard now resolves the entry path first.

  With the CLI reachable again, `walletwright --help` and `walletwright -h` print the help text
  instead of erroring with "unknown command": flags are now parsed from the whole argv rather than
  only the tokens after a command, so a leading flag is seen.

- 0341a74: Drop the `prepare` script. It rebuilt the package after every `pnpm install`, outside turbo's cache
  and graph, duplicating work `prepack` already does when publishing. Installing from a git reference
  now needs an explicit build.
- 0341a74: Fail loudly when a wallet is not actually ready, instead of handing back a broken one.

  - Phantom and Slush now tell "already unlocked" apart from "still locked", and throw when the
    extension page rendered neither. Previously Phantom's `reachUnlockScreen` returned whatever it
    found after six polls and its `unlock` returned early whenever no password field was visible, so a
    broken wallet looked launched and failed later at the first approval.
  - `buildCache` asserts that the wallet wrote state into the profile before reporting the cache, and
    the MetaMask onboarding patch throws (rather than returning quietly) when the state it means to
    patch is missing. Slush's import waits for the wallet home instead of falling through.
  - Every poll loop shares one `waitUntil` helper, so the timeout a failure reports is the timeout it
    actually waited.
  - The `wallet` fixture reads from the same launch as `context` rather than a worker-level variable,
    and no longer launches an extra Chromium per worker that no test drives.

- 25a0f0b: Fix the Slush cache build. Slush's own backend answers an automated browser with a Cloudflare 403
  whose body is a marketing page, so its GraphQL client throws at boot and renders an error screen
  instead of the wallet, which surfaced several screens later as a `Word 1` input timeout. Slush now
  answers `*.slush.app` with an empty GraphQL body through `WalletDefinition.prepareContext`, a new
  optional hook applied to both the cache-build and the test context before anything navigates.
  Onboarding, unlock, connect, and sign need nothing from that API.
- 0341a74: Verify the pinned MetaMask download against a recorded sha256. The integrity option existed but no
  caller passed it, so the pinned release archive was fetched and extracted unverified. The hash is now
  required at every download site, recorded per MetaMask version in one place, and `undefined` only for
  the Chrome Web Store fetches, whose endpoint always serves the current version and cannot be pinned.

## 0.1.0

Initial release.

### Wallets

Connect and sign are verified end to end against the real extension, headed, for every wallet below.
A wallet is only registered once it has been driven for real.

- **MetaMask** (EVM + Solana)
- **Phantom** (EVM + Solana)
- **Rabby** (EVM)
- **Solflare** (Solana)
- **Slush** (Sui)

### API

- `buildCache(setup)` onboards a wallet from a seed phrase into a cached profile on disk, once.
- `createWalletFixtures(setup)` returns a `@playwright/test` `test` with a `wallet` fixture, so there
  is no framework lock-in.
- `launchWallet(setup)` for driving a wallet outside the fixture.
- `wallet.connectToDapp()`, `confirmSignature()`, `confirmTransaction()`, `approve()`, and the
  matching `reject*()` methods.
- Optional per-wallet capabilities under `wallet.settings`, `wallet.network`, and `wallet.accounts`.
  A wallet declares only what has been driven against the real extension; anything else throws
  `[walletwright] <wallet> does not support <action>()`.
- `wallets` and `walletKindsByEcosystem(ecosystem)` for the registry.
- `walletwright cache` CLI for building profiles ahead of a test run.

### Subpath exports

- `@walletwright/core/chain` spins up a local anvil chain through `prool` for transaction tests.
- `@walletwright/core/mock` and `@walletwright/core/mock-standard` provide headless provider mocks
  (EIP-1193 and the Solana Wallet Standard) for tests that do not need a real extension.

### Notes

- Approval popups only open in **headed** Chromium. On CI, use a virtual display such as `xvfb-run`.
- `prool` and `viem` are optional peer dependencies. `@walletwright/core/chain` needs both;
  `@walletwright/core/mock` needs `viem`. The main entry and `@walletwright/core/mock-standard` need
  neither.
