---
"walletwright": patch
---

Drop the `prepare` script. It rebuilt the package after every `pnpm install`, outside turbo's cache
and graph, duplicating work `prepack` already does when publishing. Installing from a git reference
now needs an explicit build.
