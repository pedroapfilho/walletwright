---
"@walletwright/core": minor
---

`buildCache` closes the browser only once the onboarded wallet is on disk, in place of fixed sleeps and a check that some storage file exists. `WalletDefinition` gains an optional `isPersisted({ page, profileDir, extensionId })` that the build polls after `importWallet`: MetaMask's waits for its vault, which it writes about a second after its last onboarding screen, and Slush's for the session, passphrase and password hash it used to wait for inside its onboarding. A wallet without one is on disk once its extension storage has changed since onboarding began and then held still for 2s. `importWallet` now ends at its last screen, with no trailing sleep.
