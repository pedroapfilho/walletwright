# walletwright

A monorepo for [`walletwright`](./packages/walletwright), Playwright wallet automation for MetaMask
(EVM), Phantom (EVM + Solana), and Slush (Sui).

## Packages

| Package                                          | Description                                       |
| ------------------------------------------------ | ------------------------------------------------- |
| [`walletwright`](./packages/walletwright)        | The library, published to npm.                    |
| [`apps/demo`](./apps/demo)                       | A Vite dapp and Playwright tests for the wallets. |
| [`apps/docs`](./apps/docs)                       | The documentation site (Fumadocs on Next).        |
| [`apps/landing`](./apps/landing)                 | The landing page (Next and Tailwind).             |
| `@repo/typescript-config`, `@repo/config-vitest` | Shared internal configs.                          |

## Develop

```sh
pnpm install
pnpm build         # build the library
pnpm test          # unit tests and the demo E2E (run headed; use xvfb-run on CI)
pnpm lint
pnpm typecheck
```

### Run the demo end-to-end

```sh
cd apps/demo
pnpm exec playwright install chromium
pnpm test:cache    # onboard the wallets into cached profiles
pnpm test          # connect and sign on each wallet
```

## Docs and context

- [`apps/docs`](./apps/docs) is the documentation site (Fumadocs); run it with
  `pnpm --filter docs dev`. It includes a Background page on why walletwright exists and a Synpress
  issues page with the evidence that Synpress 4.1.2 is broken and unmaintained.
- [`AGENTS.md`](./AGENTS.md), symlinked as `CLAUDE.md`, is the guide for contributors and agents. It
  covers the wallet-automation gotchas that took real debugging to find.

This repo was generated from a turborepo template (pnpm, turbo, tsdown, oxlint/oxfmt, changesets,
vitest).
