---
title: 'pnpm does not link the walletwright bin into apps/demo on a fresh install'
severity: 'minor'
issue: 'pedroapfilho/walletwright#204'
---

## Expected Behavior

After `pnpm install` and a package build, `pnpm --filter demo exec walletwright` runs the CLI, since `apps/demo` depends on `@walletwright/core` and the package declares a `bin`.

## Current Behavior

`pnpm install` runs before any build, so `dist/cli.mjs` does not exist yet and pnpm skips the link with `Failed to create bin at apps/demo/node_modules/.bin/walletwright. ENOENT`. Building afterwards does not create it. The demo's `test:cache` therefore calls `node node_modules/@walletwright/core/dist/cli.mjs` by path, repeating the package's `bin` target.

## Possible Solution

Call the built file by path, as `apps/demo/package.json` does now, or run `pnpm install` a second time after the build. A committed stub at the bin path that imports the built CLI would let pnpm link it on the first install.

## Minimal Reproducible Example

In a clean worktree: `pnpm install --frozen-lockfile`, then `pnpm build:packages`, then `pnpm --filter demo exec walletwright --help`. The command is not found.

## Context

Found while moving the demo's cache script onto the package CLI (PR 195). CI's `wallets` job installs once and then builds, so it hits the same order.
