---
"@walletwright/core": patch
---

Move the MetaMask onboarding patch to classic-level 3. A missing key no longer rejects with
`LEVEL_NOT_FOUND`; it resolves `undefined`, so the reads that probed for the `OnboardingController`
and `data` keys no longer swallow every error with a `.catch()`. A read that fails for a real reason
(a corrupt or locked profile database) now surfaces instead of being reported as "MetaMask persisted
no onboarding state". Both persisted state shapes and both failure paths are covered by tests.
