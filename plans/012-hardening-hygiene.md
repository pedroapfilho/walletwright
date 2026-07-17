# Plan 012: Hardening and hygiene: mock RPC tests, action pinning, version guard, deps, plans archive

> **Executor instructions**: Follow step by step; verify each step. STOP conditions halt you. Do not
> update `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 0060500..HEAD -- packages/walletwright/src/mock.ts packages/walletwright/src/internal/download.ts .github/workflows packages/walletwright/package.json pnpm-workspace.yaml plans`
> Empty means no drift; proceed.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (branch off base)
- **Category**: security + tests + deps
- **Planned at**: commit `0060500`, 2026-07-17
- **PR grouping**: one PR (branch `improve-hardening`)

## Why this matters

Five hygiene items. (1) `walletwright/mock`'s RPC handler (hex-vs-UTF-8 personal_sign detection,
chainId hex conversion, unsupported-method rejection) has zero CI coverage; a regression ships
green. (2) `.github/workflows/react-doctor.yml` runs the third-party `millionco/react-doctor@v2` by
mutable tag while holding `pull-requests/issues/statuses: write` on main-branch pushes; pin it by
commit SHA. (3) `download.ts` builds `outDir` from a caller-supplied `version` string and later
`rm -rf`s that path; a `../`-bearing version escapes the cache dir (self-inflicted, but it deletes
an arbitrary directory). (4) Peer ranges are unbounded (`viem >=2`, `prool >=0.2`,
`@playwright/test >=1.48`), so a future major silently satisfies them; and the
`minimumReleaseAgeExclude: [prool@0.2.10]` entry carries no rationale. (5) The completed audit
plans 001-008 sit in `plans/` marked DONE against an old commit; archive them so the directory only
carries live work, and label the archive as historical so agents do not treat old executor
directives as live instructions.

## Current state

- `packages/walletwright/src/mock.ts`: `handle` is a closure inside `installMockWallet` (lines
  ~37-61), branching on `eth_requestAccounts|eth_accounts`, `eth_chainId`, `personal_sign` (regex
  `/^0x[0-9a-fA-F]*$/v` picks raw-hex vs UTF-8), `wallet_switch/addEthereumChain` (null), default
  rejection `[walletwright/mock] unsupported method: <m>`. `toHex` at ~line 23. `DEFAULT_KEY` is the
  public anvil account-0 key.
- `.github/workflows/react-doctor.yml`: permissions block lines 9-13 includes the three write
  scopes; line 26 `uses: millionco/react-doctor@v2`.
- `packages/walletwright/src/internal/download.ts:25` `const outDir = path.resolve(cacheDir, name);`
  then line ~58 `await rm(outDir, { force: true, recursive: true });` and extraction. `name` comes
  from wallet definitions, e.g. `metamask-chrome-${version}` (`wallets/metamask.ts:22`).
- `packages/walletwright/package.json` peerDependencies: `"@playwright/test": ">=1.48"`,
  `"prool": ">=0.2"`, `"viem": ">=2"`.
- `pnpm-workspace.yaml` has `minimumReleaseAgeExclude:` with `- prool@0.2.10` and no comment.
- `plans/`: 001-008 (+README rows DONE) from the 2026-07-16 cycle; 009-012 are this cycle.

Test-style reference: `packages/walletwright/src/internal/utils.test.ts` and the vitest setup;
tests are `*.test.ts` next to source, no `as any` (use `as unknown as T` if needed).

## Commands you will need

| Purpose             | Command (repo root)                                                        | Expected                 |
| ------------------- | -------------------------------------------------------------------------- | ------------------------ |
| Unit tests          | `pnpm --filter walletwright test`                                          | all pass incl. new (>21) |
| Typecheck           | `pnpm turbo typecheck --force`                                             | no error TS              |
| Lint                | `pnpm --filter walletwright lint`                                          | 0/0                      |
| Build               | `pnpm --filter walletwright build`                                         | Build complete           |
| Mock e2e still fine | `cd apps/demo && pnpm exec playwright test tests/mock.spec.ts --retries=0` | 1 passed                 |

## Scope

**In scope**: `packages/walletwright/src/mock.ts` (extract the handler), new
`packages/walletwright/src/mock.test.ts`, `.github/workflows/react-doctor.yml`,
`packages/walletwright/src/internal/download.ts` (+ its existing `download.test.ts`),
`packages/walletwright/package.json` (peer ranges), `pnpm-workspace.yaml` (comment only),
`plans/` (archive move + README note).

**Out of scope**: the mock's browser init-script; other workflows (their actions are GitHub- or
pnpm-official); wallet definitions; changing the prool version itself.

## Git workflow

Branch `improve-hardening` off base. One commit:
`fix(walletwright): test the mock RPC handler, pin CI action, guard version paths, bound peers`.
Do NOT push.

## Steps

### Step 1: Extract and unit-test the mock RPC handler

In `mock.ts`, lift the switch into a module-level pure factory
`const createRpcHandler = (account: PrivateKeyAccount, chainIdHex: string) => (rpc: Rpc) => ...`
(import the account type from `viem/accounts`; keep behavior byte-identical) and have
`installMockWallet` call it. Export it as a named export for testing (it is a reasonable public
surface for advanced users; document nothing).

Create `packages/walletwright/src/mock.test.ts` (vitest, browser-free) using
`privateKeyToAccount(<the public anvil account-0 key already in mock.ts>)`:

- `eth_accounts` and `eth_requestAccounts` resolve to `[account.address]`
- `eth_chainId` resolves to the exact hex passed in (test with 31337 -> `0x7a69`)
- `personal_sign` with a UTF-8 string message: signature verifies via viem `verifyMessage` with
  `message: "hello"`
- `personal_sign` with a raw-hex message (`0x68656c6c6f` = "hello"): verifies via `verifyMessage`
  with `message: { raw: "0x68656c6c6f" }` and equals the UTF-8 signature for the same bytes
- `wallet_addEthereumChain` resolves null; unknown method rejects with message containing
  `unsupported method`

**Verify**: `pnpm --filter walletwright test` all pass; then the mock e2e spec still passes
(rebuild first: `pnpm --filter walletwright build`).

### Step 2: Pin the react-doctor action

Resolve the current commit SHA of the `v2` tag:
`gh api repos/millionco/react-doctor/git/ref/tags/v2 --jq .object.sha` (if that ref is an annotated
tag object, dereference: `gh api repos/millionco/react-doctor/git/tags/<sha> --jq .object.sha`).
Replace line 26 with `uses: millionco/react-doctor@<full-sha> # v2` .

**Verify**: `grep -n "millionco/react-doctor@" .github/workflows/react-doctor.yml` shows a 40-char
SHA plus the version comment.

### Step 3: Guard the version/name path in download.ts

At the top of `downloadAndExtractExtension`, after computing `outDir`, assert containment exactly
like the zip-slip guard: resolve `cacheDir` and require `outDir === root || outDir.startsWith(root + path.sep)`;
throw `[walletwright] invalid extension name: <name>` otherwise. Add two cases to the existing
`download.test.ts`: a `name` of `../escape` throws `invalid extension name`; a normal name still
works (reuse the benign fixture).

**Verify**: `pnpm --filter walletwright test` all pass including the new cases.

### Step 4: Bound the peers, annotate the exclusion

`package.json` peerDependencies: `"@playwright/test": ">=1.48 <2"`, `"prool": ">=0.2 <1"`,
`"viem": ">=2 <3"`. In `pnpm-workspace.yaml`, add a comment above the `prool@0.2.10` line:
`# prool was newer than the release-age gate allowed when adopted (2026-07); drop once it ages out.`

**Verify**: `pnpm install` exits 0 with no new peer warnings in the workspace.

### Step 5: Archive completed plans

`git mv` plans 001 through 008 into `plans/archive/` (create it). Edit `plans/README.md`: add at the
top, under the title: `> Historical record: completed cycles live in archive/ and are not live
instructions. Current cycle: 009-012.` and move the 001-008 table rows into a collapsed "2026-07-16
cycle (all DONE, archived)" section beneath the current table.

**Verify**: `ls plans/` shows only 009-012, README.md, archive/; `ls plans/archive/` shows the eight
files.

### Step 6: Full gate

**Verify**: typecheck (forced), walletwright lint, unit tests, build, `pnpm format:check`.

## Done criteria

- [ ] `mock.test.ts` exists; unit count rises above 21; hex and UTF-8 personal_sign branches both
      verified via viem verifyMessage
- [ ] react-doctor pinned to a full SHA with `# v2` comment
- [ ] download.ts rejects a traversal `name`; tests prove it
- [ ] peers bounded; exclusion annotated; `pnpm install` clean
- [ ] plans 001-008 under `plans/archive/` with the historical note in README
- [ ] full gate green; mock e2e spec passes
- [ ] `git status` clean apart from in-scope files

## STOP conditions

- The tag dereference for react-doctor fails (API shape differs): report the raw API output instead
  of guessing a SHA.
- Bounding a peer range breaks `pnpm install` in-workspace: report which constraint conflicts.
- Extracting `createRpcHandler` would change any runtime behavior observable by the mock e2e spec.

## Maintenance notes

- When prool releases past 0.2.10, delete the exclusion line.
- When bumping a peer's supported major, update the bound deliberately with a changeset.
- Reviewer: read the mock tests' assertions (signature verification, not just "returns a string");
  confirm the archive move did not orphan links (plans/README references).
