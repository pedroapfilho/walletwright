---
"walletwright": minor
---

Run wallet suites headless. `launchWallet` takes `{ headless }` and `createWalletFixtures` passes
Playwright's own `headless` option through, so `--headed` and `use: { headless }` now reach the
wallet's browser. Two things made this possible: launching the `chromium` channel (Playwright's
default headless build is the headless shell, which cannot load an extension at all), and reaching
approvals through a tab. Headless, a wallet's approval window may be created without ever being
exposed as a page (MetaMask's is not; Phantom's is), leaving nothing to poll for, so the engine also
opens the wallet's new `WalletDefinition.notificationPage` itself, which lands on the same pending
request, and closes that page once the approval is settled. Both routes are watched by one poll, and
that path waits up to 60s, because a loaded CI runner routes an approval far slower than a developer
machine; give a wallet suite a Playwright `timeout` of at least `300_000` to match.

Verified end-to-end headless for MetaMask, Phantom, and Rabby on a developer machine. On a
GitHub-hosted runner only Phantom and Rabby hold up: MetaMask surfaces no approval there, so run its
specs headed under `xvfb` on that hardware. Solflare answers a headless connect
with `Connection rejected` before any approval UI exists, and Slush has no verified flow, so both
declare no `notificationPage` and `launchWallet` throws a named error for them instead of hanging;
run those specs with `test.use({ headless: false })`.
