---
"walletwright": patch
---

Fix the Slush cache build. Slush's own backend answers an automated browser with a Cloudflare 403
whose body is a marketing page, so its GraphQL client throws at boot and renders an error screen
instead of the wallet, which surfaced several screens later as a `Word 1` input timeout. Slush now
answers `*.slush.app` with an empty GraphQL body through `WalletDefinition.prepareContext`, a new
optional hook applied to both the cache-build and the test context before anything navigates.
Onboarding, unlock, connect, and sign need nothing from that API.
