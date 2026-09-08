# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Developers who test dapps: test/QA engineers and dapp developers writing Playwright end-to-end
suites that must drive real browser-extension wallets (MetaMask, Phantom, Rabby, Solflare, Slush)
instead of mocked providers. They evaluate the library from the landing page and docs, and stare at
the demo dapp while debugging wallet automation locally and on CI. (Inferred from repository
evidence; confirmed in scope by the user this session.)

## Product Purpose

walletwright is a Playwright wallet-automation library. It onboards a wallet extension from a seed
once, caches the profile, then unlocks and drives the extension's connect/sign approval popups
against a dapp under test. Success: a dapp team's e2e suite connects and signs with real wallets
across EVM, Solana, and Sui, reliably, locally and on CI.

## Positioning

Rebuilds the proven approach (onboard once, cache the profile, drive the popups) clean: plain
`@playwright/test`, current wallet and Chromium versions, no fork and no patched dependencies. A
wallet enters the registry only once connect and sign are verified end-to-end — verifying is the
whole point.

## Operating Context

- npm package `@walletwright/core`; monorepo with `apps/landing` (marketing), `apps/docs`
  (Fumadocs), `apps/demo` (the Vite test dapp the Playwright specs drive).
- The demo dapp doubles as a manual debugging surface and the automated spec target: its element
  IDs are a hard selector contract with 12 Playwright specs (`main.ts` throws at module load if any
  is missing). See AGENTS.md.
- CI runs headed under xvfb; some wallets are headed-only.

## Capabilities and Constraints

- Verified wallets: MetaMask (EVM+SVM), Rabby (EVM), Phantom (EVM+SVM), Solflare (SVM), Slush
  (SUI). Roadmap (not yet capabilities): Coinbase Wallet, Trust, Backpack, Glow, Suiet, Nightly,
  DOT and BTC wallets.
- API surface: `createWalletFixtures()`, `wallet.connectToDapp()`, `wallet.confirmSignature()`,
  `buildCache()`, `walletwright cache` CLI; optional per-wallet actions.
- Demo dapp UI constraint: all element IDs, button/input element types, `disabled` defaults, and
  the `#message` default value `Hello walletwright` are load-bearing for specs; output spans must
  hold raw undecorated textContent. `src/main.ts` is not modified by design work.
- MIT-licensed, open source, published via changesets.

## Brand Commitments

Name: walletwright (lowercase w). Existing wordmark: inline SVG `BrandLogo`
(`apps/landing/src/components/brand-logo.tsx`), currentColor so it survives any palette. The
current neutral/ink + green landing identity is explicitly NOT binding: the user commissioned three
alternative visual worlds this session (2026-09-01) that treat it as one incumbent.

Standing register (user preference, 2026-09-03): **category-conventional developer-tool design**,
benchmarked against the niche's neighbors: Synpress (direct competitor), Playwright, Vitest, viem.
Their shared canon: dark ground, one accent (test-pass green is walletwright's), big sans headline,
a code or terminal card as the hero's right half, star/license badges as proof, feature grid. Foreign
visual worlds (banking-hall ledgers, toy instructions, instrument panels) were shown and rejected;
do not re-propose them. The pass-check green and the check-in-a-square mark stay.

Chosen direction (2026-09-03): **The Reference** — a docs-native landing in the viem/wagmi
tradition (wordmark, one sentence, npm/pnpm/bun install tabs, fact badges, the six-call API as
content), promoted to `apps/landing/src/app/page.tsx`; the demo dapp carries the same world in
`apps/demo/index.html` + `src/styles/demo.css`. DESIGN.md documents the built system.

## Evidence on Hand

- Real code: the hero spec sample and `wallet-setup.ts` sample on the landing are genuine API
  usage; the ANSI test-run output is authored to mirror a real `pnpm test:e2e` pass.
- Real wallet marks via `@web3icons/react`.
- No testimonials, user counts, benchmarks, or customer logos exist. Do not fabricate them.

## Product Principles

1. Prove, don't claim: verified end-to-end is the product's whole identity; surfaces should show
   real specs, real output, real wallets.
2. The demo is an instrument, not a brochure: legibility of state (account, signature, error)
   under debugging pressure outranks expression.
3. No mocks, no forks: honesty about what is verified vs. roadmap is a brand behavior.
4. Developer-first voice: concrete nouns (fixtures, popups, cache), no marketing inflation.
