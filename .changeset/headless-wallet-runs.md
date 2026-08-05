---
"walletwright": minor
---

Run wallet suites headless. `launchWallet` takes `{ headless }` and `createWalletFixtures` passes
Playwright's own `headless` option through, so `--headed` and `use: { headless }` now reach the
wallet's browser. Two things made this possible: launching the `chromium` channel (Playwright's
default headless build is the headless shell, which cannot load an extension at all), and reaching
approvals through a tab. Headless, a wallet's approval window may be created without ever being
exposed as a page (MetaMask's is not; Phantom's is), leaving nothing to poll for, so the engine
falls back to opening the wallet's new `WalletDefinition.notificationPage` itself, which lands on
the same pending request, and closes that page once the approval is settled.

Verified end-to-end headless for MetaMask, Phantom, and Rabby. Solflare answers a headless connect
with `Connection rejected` before any approval UI exists, and Slush has no verified flow, so both
declare no `notificationPage` and `launchWallet` throws a named error for them instead of hanging;
run those specs with `test.use({ headless: false })`.
