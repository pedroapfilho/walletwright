---
"@walletwright/core": minor
---

**Breaking.** The package no longer publishes how it drives a wallet, and `headless` now means the same thing for the cache build as for the run.

`wallets`, `walletKindsByEcosystem` and the `WalletDefinition` type are gone from the package root. `wallets` exposed every wallet's onboarding flow, selectors and approval window, which no caller could use (a setup can only name a built-in wallet), and four releases (0.3.0, 0.5.0, 0.6.0, 0.7.0) carried breaking notes only because an engine refactor changed that type. In their place, `walletInfo` describes each wallet as plain data, with the `WalletInfo` type:

```ts
import { walletInfo, walletKinds } from "@walletwright/core";

walletInfo.phantom;
// { ecosystems: ["evm", "svm"], headless: true, name: "Phantom", pinnable: false }
```

Migrating:

- `wallets[kind].ecosystems` becomes `walletInfo[kind].ecosystems`, and `wallets[kind].extensionName` becomes `walletInfo[kind].name`.
- `wallets[kind].approval.headless` becomes `walletInfo[kind].headless`.
- `wallets[kind].source.kind === "release"` becomes `walletInfo[kind].pinnable`.
- `walletKindsByEcosystem("evm")` becomes `walletKinds.filter((kind) => walletInfo[kind].ecosystems.includes("evm"))`.
- Anything else read from a definition (`importWallet`, `approval`, `unlockScreen`, `actions`) has no replacement. It was never a supported way to drive a wallet.
- `Ecosystem` is `"evm" | "svm" | "sui"`. `"dot"` and `"btc"` named chains no wallet drives, and come back when one does.

`buildCache(setup, { headless: true })` and `walletwright cache --headless` now refuse a wallet that is not verified headless, with the error `launchWallet` already gave: MetaMask, Solflare and Slush throw `[walletwright] <Wallet> is not verified to run headless; leave \`headless\` off and give it a display (\`xvfb-run\` on CI).`before a browser opens. They used to try. Slush's onboarding never got past its welcome screen that way, and a MetaMask profile onboarded headless on a GitHub-hosted runner is cached broken, showing the wallet home in place of every later request. Phantom and Rabby build and run headless as before, and the fixtures still launch the other three headed whatever Playwright's`headless` says.

Migrating: drop `headless: true` (or `--headless`) when building MetaMask's, Solflare's or Slush's cache, and build under a display, which those wallets already need to run. To build a mixed list, pass `{ headless: walletInfo[setup.wallet].headless }`.

`launchWallet`'s refusal has the new wording; code that matched "has no verified headless approval flow" should match "is not verified to run headless".
