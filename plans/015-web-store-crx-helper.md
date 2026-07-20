# Plan 015: Extract the shared Chrome Web Store CRX download used by Phantom and Slush

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If anything in "STOP conditions" occurs, stop and
> report. When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 993e798..HEAD -- packages/walletwright/src/internal/download.ts packages/walletwright/src/wallets/phantom.ts packages/walletwright/src/wallets/slush.ts`
> If any of these changed, compare the "Current state" excerpts against the live code before
> proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `993e798`, 2026-07-20

## Why this matters

Phantom and Slush both download their extension from the Chrome Web Store using the same
`clients2.google.com/service/update2/crx?...` URL template, differing only in the embedded extension
id. The URL and its query params (`prodversion=130.0`, `acceptformat=crx2,crx3`) are copied in two
files today. Every roadmap Web Store wallet (Solflare, Backpack, Suiet, Nightly are all CWS
extensions) would add another copy. A change to the CWS params (for example bumping `prodversion`
when Google rejects the old value) is currently an N-file edit with no single source of truth. One
helper makes it a one-line change and makes adding the next CWS wallet trivial.

## Current state

- `packages/walletwright/src/wallets/phantom.ts:6-7` and `:47-53`:

```ts
// phantom.ts:6-7
const PHANTOM_EXTENSION_ID = "bfnaelmomeimhlpmgjnjophhpkkoljpa";
const CWS_URL = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=130.0&acceptformat=crx2,crx3&x=id%3D${PHANTOM_EXTENSION_ID}%26uc`;
// phantom.ts:47-53
prepareExtension: (cacheDir) =>
  downloadAndExtractExtension({
    cacheDir,
    kind: "crx",
    name: "phantom-chrome-latest",
    url: CWS_URL,
  }),
```

- `packages/walletwright/src/wallets/slush.ts:8-9` and `:86-92`, byte-for-byte equivalent, only the
  id and cache `name` differ:

```ts
// slush.ts:8-9
const SLUSH_EXTENSION_ID = "opcgpfmipidbgpenhmajoajpbobppdil";
const CWS_URL = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=130.0&acceptformat=crx2,crx3&x=id%3D${SLUSH_EXTENSION_ID}%26uc`;
// slush.ts:86-92
prepareExtension: (cacheDir) =>
  downloadAndExtractExtension({
    cacheDir,
    kind: "crx",
    name: "slush-chrome-latest",
    url: CWS_URL,
  }),
```

- `packages/walletwright/src/internal/download.ts` owns download/extract and exports
  `downloadAndExtractExtension`. The new helper belongs here (same layer). Note the module keeps
  exports where they currently sit; match the file's existing convention.

## Commands you will need

| Purpose    | Command                                     | Expected on success |
| ---------- | ------------------------------------------- | ------------------- |
| Install    | `pnpm install`                              | exit 0              |
| Unit tests | `pnpm turbo run test --filter=walletwright` | all pass            |
| Typecheck  | `pnpm typecheck`                            | exit 0              |
| Lint       | `pnpm lint`                                 | exit 0              |
| Dead-code  | `pnpm fallow:dead`                          | exit 0              |
| Build      | `pnpm --filter walletwright build`          | exit 0              |

## Scope

**In scope** (only files you should modify):

- `packages/walletwright/src/internal/download.ts` (add the helper)
- `packages/walletwright/src/internal/download.test.ts` (add a URL-builder test)
- `packages/walletwright/src/wallets/phantom.ts` (use the helper)
- `packages/walletwright/src/wallets/slush.ts` (use the helper)

**Out of scope** (do NOT touch):

- `packages/walletwright/src/wallets/metamask.ts` (downloads a `.zip` from GitHub releases, a
  different `kind` and URL shape; do not fold it into the CWS helper).
- The onboarding/unlock/approve flows in phantom.ts and slush.ts.

## Git workflow

- Branch: `improve-web-store-crx-helper`.
- Conventional-commit message, e.g. `refactor(download): extract shared Chrome Web Store CRX helper`.
- Do NOT push or open a PR unless the operator asks.

## Steps

### Step 1: Add a helper in `download.ts`

Add a function that builds the CWS URL from an extension id and wraps `downloadAndExtractExtension`.
Match the existing param-object style. Target shape:

```ts
/** Build the Chrome Web Store CRX download URL for an extension id. */
const chromeWebStoreCrxUrl = (extensionId: string): string =>
  `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=130.0&acceptformat=crx2,crx3&x=id%3D${extensionId}%26uc`;

/** Download and extract a Chrome Web Store extension (latest) into `<cacheDir>/<name>`. */
export const prepareWebStoreExtension = (options: {
  cacheDir: string;
  extensionId: string;
  name: string;
}): Promise<string> =>
  downloadAndExtractExtension({
    cacheDir: options.cacheDir,
    kind: "crx",
    name: options.name,
    url: chromeWebStoreCrxUrl(options.extensionId),
  });
```

Export `chromeWebStoreCrxUrl` too (the test asserts the URL string).

**Verify**: `pnpm typecheck` exit 0.

### Step 2: Switch Phantom to the helper

In `phantom.ts`, remove the local `CWS_URL` constant and set `prepareExtension` to call the helper,
importing `prepareWebStoreExtension` from `../internal/download.ts`; keep `PHANTOM_EXTENSION_ID`:

```ts
prepareExtension: (cacheDir) =>
  prepareWebStoreExtension({
    cacheDir,
    extensionId: PHANTOM_EXTENSION_ID,
    name: "phantom-chrome-latest",
  }),
```

**Verify**: `pnpm typecheck` exit 0.

### Step 3: Switch Slush to the helper

Same change in `slush.ts` (remove local `CWS_URL`, use the helper with `SLUSH_EXTENSION_ID` and
`name: "slush-chrome-latest"`); keep `SLUSH_EXTENSION_ID`.

**Verify**: `pnpm typecheck` exit 0; `pnpm lint` exit 0; `pnpm fallow:dead` exit 0 (confirms no
orphaned constant).

### Step 4: Confirm behavior unchanged

`chromeWebStoreCrxUrl("bfnaelmomeimhlpmgjnjophhpkkoljpa")` must equal the old Phantom `CWS_URL`, and
the same for Slush's id.

**Verify**: `pnpm turbo run test --filter=walletwright` all pass (including the new URL test);
`pnpm --filter walletwright build` exit 0.

## Test plan

- Add to `download.test.ts` a test asserting `chromeWebStoreCrxUrl(id)` produces the exact expected
  URL for a sample id (assert the full string so a future param change is caught). Cover both the
  Phantom and Slush ids to pin that the extraction is a pure id substitution.
- Structural pattern: existing describe/it blocks in `download.test.ts`.
- Verification: `pnpm turbo run test --filter=walletwright` all pass, including the new cases.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -rn "clients2.google.com" packages/walletwright/src` returns only the helper in
      `download.ts` (no copies in phantom.ts / slush.ts)
- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm fallow:dead` exits 0
- [ ] `pnpm turbo run test --filter=walletwright` exits 0 (new URL test passes)
- [ ] `pnpm --filter walletwright build` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report (do not improvise) if:

- The Phantom or Slush `prepareExtension` excerpt no longer matches "Current state".
- The generated URL for either id differs from the original string (keep params identical; do not
  "fix" them in this refactor).

## Maintenance notes

- Adding a future Web Store wallet now means calling `prepareWebStoreExtension` with its id, not
  copying the URL.
- If Google changes `prodversion`/`acceptformat`, update `chromeWebStoreCrxUrl` only.
