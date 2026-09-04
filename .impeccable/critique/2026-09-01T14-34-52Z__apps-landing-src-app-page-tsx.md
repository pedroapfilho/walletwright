---
target: landing page main screen
total_score: 29
max_score: 36
na_heuristics: 7
p0_count: 0
p1_count: 1
timestamp: 2026-09-01T14-34-52Z
slug: apps-landing-src-app-page-tsx
---

# Critique — landing page (apps/landing), mode Persuade

Method: dual-agent. Detector: 0 findings (full fidelity).

## Heuristics: 29/36 (9 scored; #7 n/a — single-scroll marketing page, no repeat-user workflow)

1 Status 3 (silent copy failure) · 2 Real world 4 · 3 Control 3 · 4 Consistency 3 (soft final CTA; Slush icon = Sui chip) · 5 Prevention 3 (public seed unqualified) · 6 Recognition 3 · 7 n/a · 8 Minimalist 4 · 9 Recovery 2 (copy fails invisibly) · 10 Docs 4

## Specificity: authored, convincingly

Pass-green primary = the ✓ in a real captured ANSI run; logo = approve checkmark; comments carry product reasoning.

## Priority issues

- [P1] Five wallets claimed, four proven: hero RUN_OUTPUT omits slush.spec.ts; caption says "Four wallets" above "all five". Fix: recapture with Slush or explain headed-only.
- [P2] Slush card icon duplicates its ecosystem chip (wallets.tsx:62).
- [P2] Silent copy failure (copy-button.tsx:46-48) — no failure state via live region.
- [P2] No OG image despite summary_large_image.
- [P3] Public test seed in setup sample without the Phantom/Slush caveat.
- [P3] Final CTA variant="soft" de-escalates the conversion moment.

## Personas

Jordan: mechanism-before-problem hero paragraph; 4-vs-5 mismatch. Riley: only hole is silent copy failure. Casey: well served; Docs hidden from mobile header.

## Emotional journey

Peak = timed passing run; its valley = the missing fifth wallet at the moment of proof. All proof first-party.

## Questions

- Why is the passing run static text (no CI badge/link → verifiable fact)?
- Worth naming what walletwright does that Synpress can't?
- No tension anywhere: reader never feels the flaky-run pain being solved.
