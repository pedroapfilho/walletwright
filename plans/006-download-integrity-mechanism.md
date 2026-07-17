# Plan 006: Add an optional integrity check to extension downloads

> **Executor instructions**: Follow step by step; verify each step. STOP conditions halt you. Update
> `plans/README.md` when done unless a reviewer maintains it.
>
> **Drift check (run first)**:
> `git diff --stat 0f0db25..HEAD -- packages/walletwright/src/internal/download.ts packages/walletwright/src/types.ts`
> On any change, compare against "Current state"; mismatch means STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (but if 005 is being executed in the same worktree, do 005 first so both edits
  to `download.ts` and `download.test.ts` compose cleanly)
- **Category**: security
- **Planned at**: commit `0f0db25`, 2026-07-16

## Why this matters

`downloadAndExtractExtension` fetches an extension archive over the network and extracts it with no
integrity verification. A compromised release, a hijacked mirror, or a swapped Chrome Web Store CRX
would be loaded and driven with a (test) wallet on a dev or CI machine. This plan adds the
*mechanism*: an optional `sha256` that, when provided, is checked against the downloaded bytes before
extraction, throwing on mismatch. It deliberately does NOT hard-code any hash values: a trustworthy
hash must come from the vendor's published checksum, not from re-hashing whatever we downloaded
(which would give false assurance). Pinning real hashes is a follow-up maintainer task, noted below.

Note: only MetaMask downloads from a versioned URL (a specific release tag), so only MetaMask is even
pinnable later. Phantom and Slush pull "latest" from the Chrome Web Store, whose bytes change over
time and cannot be pinned. So this plan wires the mechanism through but pins nothing.

## Current state

- `packages/walletwright/src/internal/download.ts`. The download (`download.ts:16-37`):

```ts
export const downloadAndExtractExtension = async (options: {
  cacheDir: string;
  kind: "zip" | "crx";
  name: string;
  url: string;
}): Promise<string> => {
  const { cacheDir, kind, name, url } = options;
  const outDir = path.resolve(cacheDir, name);
  if (existsSync(path.join(outDir, "manifest.json"))) {
    return outDir;
  }

  await mkdir(cacheDir, { recursive: true });

  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(
      `[walletwright] failed to download ${url}: ${response.status} ${response.statusText}`,
    );
  }
  const bytes = Buffer.from(await response.arrayBuffer());
```

`createHash` from `node:crypto` is already used in `internal/utils.ts` (`createHash("sha256")`), use
the same API.

- `packages/walletwright/src/types.ts` holds `WalletDefinition.prepareExtension`:
  `prepareExtension: (cacheDir: string, version?: string) => Promise<string>;`. The wallet
  definitions call `downloadAndExtractExtension` inside their `prepareExtension`. No change to the
  `prepareExtension` signature is needed for this plan; only the internal download options gain an
  optional field.

Repo conventions: arrow functions, `.ts` extensions, comments only for a non-obvious WHY, no long
dash (U+2014), `[walletwright] ...` error prefix.

## Commands you will need

| Purpose   | Command (from repo root)               | Expected on success |
|-----------|----------------------------------------|---------------------|
| Typecheck | `pnpm --filter walletwright typecheck` | exit 0, no errors   |
| Lint      | `pnpm --filter walletwright lint`      | 0 warnings 0 errors |
| Build     | `pnpm --filter walletwright build`     | "Build complete"    |
| Unit test | `pnpm --filter walletwright test`      | all pass (incl. new)|

## Scope

**In scope**:
- `packages/walletwright/src/internal/download.ts`
- `packages/walletwright/src/internal/download.test.ts` (create, or extend if 005 created it)

**Out of scope**:
- The wallet definitions (`metamask.ts`, `phantom.ts`, `slush.ts`); do NOT add hash values to them.
- `WalletDefinition.prepareExtension` signature in `types.ts`; unchanged.

## Git workflow

- Commit: `feat(walletwright): verify extension download against optional sha256`.
- Do NOT push or open a PR.

## Steps

### Step 1: Add an optional `sha256` option and verify it

Add `sha256?: string` to the `downloadAndExtractExtension` options object. After computing `bytes`,
if `sha256` is provided, compute the SHA-256 of `bytes` (lowercase hex) and throw on mismatch, before
any extraction. Import `createHash` from `node:crypto`.

Target shape:

```ts
import { createHash } from "node:crypto";
// ...
export const downloadAndExtractExtension = async (options: {
  cacheDir: string;
  kind: "zip" | "crx";
  name: string;
  sha256?: string;
  url: string;
}): Promise<string> => {
  const { cacheDir, kind, name, sha256, url } = options;
  // ...
  const bytes = Buffer.from(await response.arrayBuffer());

  if (sha256) {
    const actual = createHash("sha256").update(bytes).digest("hex");
    if (actual !== sha256.toLowerCase()) {
      throw new Error(
        `[walletwright] ${name} failed integrity check: expected ${sha256}, got ${actual}`,
      );
    }
  }
```

Keep the destructure list alphabetically sorted if the file/lint expects it (the options object keys
are already alphabetical: `cacheDir, kind, name, url`; insert `sha256` before `url`).

**Verify**: `pnpm --filter walletwright typecheck` → exit 0.

### Step 2: Unit-test the mechanism

Add tests to `download.test.ts` (create it if 005 did not; if 005 created it, reuse its local
`node:http` fixture-server helper, do NOT use `file://`). Browser-free. Cases:
- correct `sha256` (compute it from your fixture bytes with `createHash("sha256").update(bytes).digest("hex")`
  in the test) → extraction succeeds.
- wrong `sha256` (e.g. `"0".repeat(64)`) → throws an error whose message contains
  `failed integrity check`.
- no `sha256` (undefined) → extraction succeeds (unchanged behavior).

Serve the fixture bytes over the same throwaway `node:http` server pattern plan 005 uses (undici
`fetch` supports `http://127.0.0.1`, not `file://`). Clean up temp dirs and close the server after.

**Verify**: `pnpm --filter walletwright test` → all pass, including the three cases.

### Step 3: Lint and build

**Verify**: `pnpm --filter walletwright lint` → 0 warnings 0 errors; `pnpm --filter walletwright build`
→ "Build complete".

## Test plan

Covered by Step 2. Do NOT attempt to download a real extension and pin its hash; that is explicitly
out of scope (see "Why this matters"). The tests exercise the mechanism with local fixtures only.

## Done criteria

ALL must hold:

- [ ] `pnpm --filter walletwright typecheck` exits 0
- [ ] `pnpm --filter walletwright test` passes, with new tests covering correct-hash, wrong-hash
      (throws `failed integrity check`), and no-hash cases
- [ ] `pnpm --filter walletwright lint` reports 0 warnings, 0 errors
- [ ] `pnpm --filter walletwright build` prints "Build complete"
- [ ] `download.ts` has an optional `sha256` option that is verified before extraction
- [ ] No hash values were added to any wallet definition (`grep -rn "sha256" packages/walletwright/src/wallets/`
      returns nothing)
- [ ] `git status` shows only `download.ts` and `download.test.ts` modified/created
- [ ] `plans/README.md` row for 006 updated (unless the reviewer maintains it)

## STOP conditions

Stop and report if:

- The `download.ts` excerpt does not match the live code (drift).
- The local `node:http` fixture server does not work in the test runtime: report the exact error
  rather than falling back to a public network URL or skipping the mechanism.

## Maintenance notes

- Follow-up (maintainer task, not this plan): source MetaMask's published SHA-256 for each pinned
  release from a trusted channel and pass it through `metamask.ts`'s `prepareExtension`. Do not pin a
  self-computed hash; that verifies nothing.
- Phantom and Slush use unversioned Chrome Web Store URLs and cannot be pinned; leave them
  hash-less.
- Reviewer: confirm the check runs BEFORE extraction and that the no-hash path is byte-for-byte the
  prior behavior.
