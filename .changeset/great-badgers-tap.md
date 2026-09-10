---
"@walletwright/core": minor
---

`connectToDapp` now accepts `{ optional: true }` and waits for a required popup by default. A site the wallet already trusts connects without one; passing the flag keeps the short wait and resolves quietly, while the default flags a missing popup instead of silently succeeding.
