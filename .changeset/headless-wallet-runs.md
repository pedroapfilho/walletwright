---
"@walletwright/core": minor
---

Run wallet suites headless. `launchWallet` takes `{ headless }` and `createWalletFixtures` passes
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
