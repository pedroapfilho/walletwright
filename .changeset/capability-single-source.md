---
"@walletwright/core": patch
---

Declare each wallet capability once. `AccountActions`, `NetworkActions` and `SettingsActions` are now
derived from the matching `AccountsApi`, `NetworkApi` and `SettingsApi` types on `Wallet`, so a
capability's name and argument list are written in a single place and the controller stops compiling
until a new one is bound. Published types are unchanged: the derived aliases resolve to exactly the
shapes they replaced.
