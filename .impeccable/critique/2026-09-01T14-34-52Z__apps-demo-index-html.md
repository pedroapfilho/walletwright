---
target: demo test dapp main screen
total_score: 15
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 3
timestamp: 2026-09-01T14-34-52Z
slug: apps-demo-index-html
---

# Critique — demo test dapp (apps/demo/index.html), mode Operate

Method: dual-agent. Detector: 0 findings but DEGRADED (regex-only; no CSS to evaluate).

## Heuristics: 15/40

1 Status 1 (5s silent provider poll, no pending state) · 2 Real world 2 ("Mock (Solana)" mislabels the Solflare path) · 3 Control 2 · 4 Consistency 2 (MetaMask EVM deviates; unprefixed ids) · 5 Prevention 1 (tx/chain buttons live pre-connect) · 6 Recognition 1 · 7 Flexibility 2 · 8 Minimalist 1 (zero CSS) · 9 Recovery 3 (EIP-1193 unwrap is excellent) · 10 Docs 0 (anvil requirement unstated)

## Specificity: undesigned surface over a well-designed skeleton

IA is exactly the product (6 sections = verified wallet×ecosystem pairs); rendering is anonymous. Cognitive load: 6/8 checklist failures; 10 equally-weighted buttons.

## Priority issues

- [P1] Zero CSS defeats the operating purpose: failing and passing pages look identical in a Playwright screenshot.
- [P1] "Mock (Solana, SVM)" is false labeling for the section solflare.spec.ts drives; "Solflare" absent from the page.
- [P1] Outcomes silent to assistive tech: no aria-live; #message unlabeled; sign-enable unannounced.
- [P2] No pending state; double-click races duplicate approval popups.
- [P2] Pre-connect footguns: sendTx/switchChain enabled with empty account.
- [P3] Inconsistent id scheme (frozen by the spec selector contract).

## Personas

Alex: scans for "Solflare", absent; silent connect; wrapping serif hex. Sam: hears nothing after any action; unlabeled input; unannounced state changes.

## Notes

Strengths: error-message.ts EIP-1193 unwrapping; disciplined section template; semantic skeleton (native buttons, headings). Constraint: all element IDs, button/input types, disabled defaults, #message value are load-bearing for 12 specs; main.ts unmodifiable by design work.
