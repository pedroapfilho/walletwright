---
"@walletwright/core": patch
---

Declare `"sideEffects": false` so bundlers can drop unused entry points. None of the exports runs code at import time.
