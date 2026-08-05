---
"@walletwright/core": patch
---

Verify the pinned MetaMask download against a recorded sha256. The integrity option existed but no
caller passed it, so the pinned release archive was fetched and extracted unverified. The hash is now
required at every download site, recorded per MetaMask version in one place, and `undefined` only for
the Chrome Web Store fetches, whose endpoint always serves the current version and cannot be pinned.
