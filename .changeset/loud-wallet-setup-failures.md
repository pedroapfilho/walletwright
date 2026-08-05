---
"@walletwright/core": patch
---

Fail loudly when a wallet is not actually ready, instead of handing back a broken one.

- Phantom and Slush now tell "already unlocked" apart from "still locked", and throw when the
  extension page rendered neither. Previously Phantom's `reachUnlockScreen` returned whatever it
  found after six polls and its `unlock` returned early whenever no password field was visible, so a
  broken wallet looked launched and failed later at the first approval.
- `buildCache` asserts that the wallet wrote state into the profile before reporting the cache, and
  the MetaMask onboarding patch throws (rather than returning quietly) when the state it means to
  patch is missing. Slush's import waits for the wallet home instead of falling through.
- Every poll loop shares one `waitUntil` helper, so the timeout a failure reports is the timeout it
  actually waited.
- The `wallet` fixture reads from the same launch as `context` rather than a worker-level variable,
  and no longer launches an extra Chromium per worker that no test drives.
