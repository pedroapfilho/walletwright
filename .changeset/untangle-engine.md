---
"@walletwright/core": minor
---

The build and the run now resolve a setup's files in one place, so they cannot disagree about where its cache lives. Web Store extensions are cached as `webstore-<extension id>` instead of `<wallet>-chrome-latest`, and the profile key no longer includes the wallet kind, since the archive name already does. Existing caches must be rebuilt once with `walletwright cache` or `buildCache`.

`WalletActionContext` now holds only what actions use, `home` and `unlock`, and `importWallet` receives the seed already split into words. This only affects code that reads the definitions in `wallets`.

`@walletwright/core/mock` and `@walletwright/core/mock-standard` export only their install functions and option types. The request handlers and key helpers they exported for the package's own tests (`createRpcHandler`, `createStandardHandler`, `encodeBase58`, `privateKeyFromSeed`) are internal now.
