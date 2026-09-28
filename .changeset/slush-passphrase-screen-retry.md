---
"@walletwright/core": patch
---

Retry opening Slush's passphrase import screen until its word inputs appear, and fail with a clear error after three attempts. On a slow runner the first "Import existing from passphrase" click could land before the menu was interactive, which left the import waiting on inputs that never rendered.
