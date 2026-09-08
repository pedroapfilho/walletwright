---
title: "React Doctor scans ignored downloaded wallet extensions"
severity: "minor"
---

## Problem

After running the demo wallet-cache onboarding, React Doctor 0.9.13 full scans traverse apps/demo/.walletwright even though git ignores it. The scanner reports 66 findings in downloaded third-party extension bundles and no findings in authored source.

## Reproduce

Run the demo test:cache script, then the full React Doctor scan used in CI.

## Workaround

Run source scans in a fresh checkout before onboarding, or preserve the disposable test cache outside the checkout while scanning. Do not disable the security rules or commit vendor bundles.
