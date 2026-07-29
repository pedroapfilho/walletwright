# walletwright

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

- `walletwright/chain` spins up a local anvil chain through `prool` for transaction tests.
- `walletwright/mock` and `walletwright/mock-standard` provide headless provider mocks (EIP-1193 and
  the Solana Wallet Standard) for tests that do not need a real extension.

### Notes

- Approval popups only open in **headed** Chromium. On CI, use a virtual display such as `xvfb-run`.
- `prool` and `viem` are optional peer dependencies. `walletwright/chain` needs both;
  `walletwright/mock` needs `viem`. The main entry and `walletwright/mock-standard` need neither.
