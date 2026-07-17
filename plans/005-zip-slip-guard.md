# Plan 005: Guard extension extraction against zip-slip path traversal

> **Executor instructions**: Follow step by step; verify each step. STOP conditions halt you. Update
> `plans/README.md` when done unless a reviewer maintains it.
>
> **Drift check (run first)**: `git diff --stat 0f0db25..HEAD -- packages/walletwright/src/internal/download.ts`
> On any change, compare against "Current state"; mismatch means STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `0f0db25`, 2026-07-16

## Why this matters

`downloadAndExtractExtension` extracts a downloaded archive with
`new AdmZip(zipBytes).extractAllTo(outDir, true)`. `extractAllTo` writes each entry to its path
relative to `outDir` without guaranteeing the resolved path stays inside `outDir`. An archive with an
entry like `../../evil.sh` can write outside the cache dir (classic zip-slip / CVE-2018-1002204). The
current sources are trusted (official MetaMask releases, Chrome Web Store), but `prepareExtension`
takes an arbitrary `url`, and a wallet author or a compromised mirror could ship a malicious archive.
Validating entry paths before extraction closes the hole cheaply.

## Current state

- `packages/walletwright/src/internal/download.ts`. The extraction (`download.ts:38-53`):

```ts
let zipBytes = bytes;
if (kind === "crx") {
  const start = bytes.indexOf(ZIP_SIGNATURE);
  if (start === -1) {
    throw new Error(`[walletwright] ${url} is not a valid CRX (no ZIP header found)`);
  }
  zipBytes = bytes.subarray(start);
}

await rm(outDir, { force: true, recursive: true });
new AdmZip(zipBytes).extractAllTo(outDir, /* overwrite */ true);

if (!existsSync(path.join(outDir, "manifest.json"))) {
  throw new Error(`[walletwright] extracted ${name} but no manifest.json found in ${outDir}`);
}
return outDir;
```

Imports (`download.ts:1-5`):

```ts
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

import AdmZip from "adm-zip";
```

`adm-zip` API: `zip.getEntries()` returns entries with an `entryName` string (the archive-relative
path, forward-slashed). `zip.extractEntryTo(entry, targetPath, maintainEntryPath, overwrite)` exists,
but the simplest safe approach is to validate every `entryName` resolves under `outDir`, then call
`extractAllTo` as today.

Repo conventions: arrow functions, `const` over `let`, `.ts` extensions, comments only for a
non-obvious WHY, no long dash (U+2014). Error messages use the `[walletwright] ...` prefix.

## Commands you will need

| Purpose   | Command (from repo root)               | Expected on success  |
| --------- | -------------------------------------- | -------------------- |
| Typecheck | `pnpm --filter walletwright typecheck` | exit 0, no errors    |
| Lint      | `pnpm --filter walletwright lint`      | 0 warnings 0 errors  |
| Build     | `pnpm --filter walletwright build`     | "Build complete"     |
| Unit test | `pnpm --filter walletwright test`      | all pass (incl. new) |

## Scope

**In scope**:

- `packages/walletwright/src/internal/download.ts`
- `packages/walletwright/src/internal/download.test.ts` (create)

**Out of scope**:

- The CRX header slicing logic (`ZIP_SIGNATURE`, `indexOf`); leave it.
- The download/fetch logic; leave it.
- The wallet definitions that call this.

## Git workflow

- Commit: `fix(walletwright): reject zip entries that escape the extraction dir`.
- Do NOT push or open a PR.

## Steps

### Step 1: Add an entry-path guard before extraction

Before `extractAllTo`, iterate the zip entries and throw if any entry resolves outside `outDir`.
Compute the resolved target for each entry and confirm it is `outDir` itself or nested under it.

Target shape (replace the `new AdmZip(...).extractAllTo(...)` line region):

```ts
await rm(outDir, { force: true, recursive: true });
const zip = new AdmZip(zipBytes);
const root = path.resolve(outDir);
for (const entry of zip.getEntries()) {
  const target = path.resolve(root, entry.entryName);
  // Reject zip-slip: an entry like "../../x" must not resolve outside the extraction root.
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error(`[walletwright] refusing to extract ${entry.entryName}: escapes ${outDir}`);
  }
}
zip.extractAllTo(outDir, /* overwrite */ true);
```

**Verify**: `pnpm --filter walletwright typecheck` → exit 0.

### Step 2: Add a unit test for the guard

Create `packages/walletwright/src/internal/download.test.ts`. It must be browser-free (runs in the
CI vitest suite). Build the fixture archives in memory with `adm-zip` (`new AdmZip()`,
`zip.addFile(name, Buffer.from(...))`, `zip.toBuffer()`), then serve those bytes over a throwaway
local HTTP server so `downloadAndExtractExtension` exercises its real fetch-and-extract path.

Do NOT use a `file://` URL: Node's built-in `fetch` (undici) rejects `file://` in this runtime. Use
`node:http` instead, which undici's `fetch` supports:

```ts
import { createServer, type Server } from "node:http";
// ...
const serve = async (bytes: Buffer): Promise<{ url: string; close: () => Promise<void> }> => {
  const server: Server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/octet-stream" });
    res.end(bytes);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return {
    url: `http://127.0.0.1:${port}/ext.zip`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
};
```

Write each fixture-extraction call to a fresh `os.tmpdir()` cache dir (via `mkdtemp`), and clean up
the temp dirs and close the server in an `afterEach`/`afterAll`. Model the vitest style on
`packages/walletwright/src/wallets/registry.test.ts`.

Test cases:

- benign archive (contains `manifest.json`) extracts, and the returned dir contains `manifest.json`.
- archive with an entry named `../escape.txt` throws an error whose message contains `escapes`.

**Verify**: `pnpm --filter walletwright test` → all pass, including the two new cases.

### Step 3: Lint and build

**Verify**: `pnpm --filter walletwright lint` → 0 warnings 0 errors; `pnpm --filter walletwright build`
→ "Build complete".

## Test plan

Covered by Step 2. The traversal case is the regression guard; the benign case proves normal
extraction still works. Clean up any temp dirs the test creates in an `afterEach`/`afterAll`.

## Done criteria

ALL must hold:

- [ ] `pnpm --filter walletwright typecheck` exits 0
- [ ] `pnpm --filter walletwright test` passes, with new tests in `download.test.ts` covering a
      traversal entry (throws) and a benign archive (extracts)
- [ ] `pnpm --filter walletwright lint` reports 0 warnings, 0 errors
- [ ] `pnpm --filter walletwright build` prints "Build complete"
- [ ] `download.ts` validates entry paths before `extractAllTo`
- [ ] `git status` shows only `download.ts` and `download.test.ts` modified/created
- [ ] `plans/README.md` row for 005 updated (unless the reviewer maintains it)

## STOP conditions

Stop and report if:

- The `download.ts` excerpt does not match the live code (drift).
- The local `node:http` server approach in Step 2 does not work in the test runtime (undici `fetch`
  cannot reach `http://127.0.0.1`): report the exact error rather than falling back to a network
  URL or weakening the guard.
- `adm-zip`'s `getEntries()` or `entryName` is not available at the installed version; report the
  actual API rather than guessing.

## Maintenance notes

- If the extraction ever switches away from `adm-zip` (AGENTS.md explains why adm-zip was chosen over
  extract-zip), re-apply an equivalent traversal guard in the new extractor.
- Reviewer: confirm the guard uses `root + path.sep` (not a bare `startsWith(root)`, which would let
  a sibling dir `outDir-evil` slip through) and that the benign path still extracts.
