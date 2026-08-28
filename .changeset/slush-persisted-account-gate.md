---
"@walletwright/core": patch
---

Fix the Slush onboarding gate, which could never pass. It waited for `dataLayerMigrated`/`dataLayerMigrationStartedAt` on the preferences row, and current Slush (26.18.1) writes neither field, so every cache build failed after 60s regardless of the timeout. The gate now waits for what the cache actually needs: an account in `signaldb-accounts` and a preferences row whose `currentAccountId` selects it.
