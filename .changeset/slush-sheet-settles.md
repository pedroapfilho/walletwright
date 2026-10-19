---
"@walletwright/core": patch
---

Slush onboarding no longer fails intermittently with "Slush never opened the passphrase import screen" on slow renderers such as Linux CI under Xvfb. A forced click now waits for any animation moving the control to finish, not only for its position to read unchanged, so it no longer lands on a sheet held mid-slide, where Slush drops the press.
