---
"@walletwright/core": minor
---

Make the fixtures work on Playwright's defaults, report every wallet call as a step, and make the public surface promise only what the engine does.

**The fixtures pick headless per wallet.** `createWalletFixtures` passed Playwright's `headless` straight through, and Playwright defaults it to `true`, so a MetaMask, Solflare, or Slush suite written from the getting-started guide threw at launch until the config set `headless: false`. The fixtures now launch headless only where the wallet declares support (Phantom, Rabby) and open a real window for the rest, so no `headless` setting is needed. `launchWallet` keeps its strict behaviour and still refuses headless for those wallets by name.

**Wallet calls are Playwright steps.** Each call (`wallet.connectToDapp`, `wallet.accounts.add`, …) is reported as a boxed `test.step` under its own name in the report and trace, and a failing call now shows a code frame at the spec line that made it rather than at the engine. The launch shows up as `launch <Wallet>`.

**`launchWallet` supports `await using`.** `LaunchedWallet` implements `Symbol.asyncDispose`, so `await using launched = await launchWallet(setup)` closes the browser and removes the throwaway profile on scope exit, even when the code throws.

**The CLI reads the setup file the docs show.** `walletwright cache --setup <file>` builds every `WalletSetup` the module exports, named or default, one after another, instead of requiring a default export. `--wallet` narrows it to one wallet's setups. A setup-shaped export that fails validation is reported by name; the list of valid wallets now comes from the registry.

**Breaking:**

- `WalletSetup.version` is refused for Phantom, Rabby, Solflare, and Slush. They run their Chrome Web Store build, which cannot be pinned; `version` was silently ignored for the download while still forking the profile cache.
- `wallet.network.switch` is removed. No wallet implemented it, so it could only throw; switching is dapp-initiated through `wallet_addEthereumChain` and `wallet.approve()`.
- `WalletDefinition` replaces `prepareExtension`, `reachUnlockScreen`, and `unlock` with declarative `source` and `unlockScreen` fields, and `WalletActionContext` gains `unlock()`. This only affects code that reads the definitions in `wallets`; a setup can only name a built-in wallet.

`walletKinds` and the `NetworkConfig` type are now exported.
