---
"@walletwright/core": patch
---

Slush onboards, unlocks, connects and signs again on its current release (26.21.1). Onboarding follows the new import flow (Get started, skip the phone or email sign-in, Passphrase, Import), the cache waits for the session, passphrase and password hash Slush now stores in its `keyval-store` IndexedDB, and the unlock clicks its button once the password registers. Slush's backend is no longer stubbed: it now holds the wallet's accounts and connected sites, so runs need to reach `api.slush.app`, and a site connected in one run from a cache is already trusted in the next (connect with `connectToDapp({ optional: true })`).
