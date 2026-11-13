---
"@walletwright/core": patch
---

A wallet action that waits for a control to go away now fails the way a missing control does, naming the wallet, the control and how long it waited: `[walletwright] MetaMask still showed getByTestId('import-account-confirm-button') (gave up after 15s)`. `accounts.switch` used to report any failure there as "did not switch (menu stayed open)", and `network.add` waited on its dialog with no budget of its own.
