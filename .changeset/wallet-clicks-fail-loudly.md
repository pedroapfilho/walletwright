---
"@walletwright/core": patch
---

Wallet onboarding, unlock, and account, network, and settings actions now click through one helper that waits for each control to show. A control the flow needs and never sees fails with `[walletwright] <Wallet> never showed <control>`, and a control that shows but takes no click fails naming it, where some of these clicks used to no-op or time out silently. Phantom's unlock clicks its Unlock button rather than falling back to Enter, and its onboarding no longer looks for a "Get Started" step the current extension does not show.
