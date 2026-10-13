---
"@walletwright/core": patch
---

`walletwright cache --setup` now rejects a setup export with a key `WalletSetup` does not have, naming the export and the key, instead of silently dropping it. A misspelled `cacheDir` used to build into the default cache directory without a word.
