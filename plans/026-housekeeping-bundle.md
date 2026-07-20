# Plan 026: Housekeeping bundle (deps, CI setup drift, workspace cruft, minor smells)

> **Executor instructions**: This plan is FIVE INDEPENDENT small tasks (A-E). Do them in any order;
> each has its own verification. If one hits a STOP condition, skip it and continue the others, then
> report which you skipped. Update this plan's row in `plans/README.md` when done (note any skipped).
>
> **Drift check (run first)**: `git diff --stat 993e798..HEAD -- pnpm-workspace.yaml .github/workflows/react-doctor.yml packages/walletwright/src/internal/controller.ts packages/walletwright/src/internal/utils.ts apps/landing/src/components/wallets.tsx packages/walletwright/package.json`
> On a mismatch with a task's excerpt, treat that task as STOP (skip it).

## Status

- **Priority**: P3
- **Effort**: S (each task)
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `993e798`, 2026-07-20

## Why this matters

Five low-risk tidy-ups that individually are noise but collectively keep the repo honest and reduce
audit churn: a dev-only `tar` advisory, CI setup-action drift, a stale workspace exclusion, a
duplicated default constant, and a landing-icon inconsistency.

## Commands you will need

| Purpose    | Command                                     | Expected on success                |
| ---------- | ------------------------------------------- | ---------------------------------- |
| Install    | `pnpm install`                              | exit 0                             |
| Audit      | `pnpm audit`                                | fewer high tar advisories (Task A) |
| Typecheck  | `pnpm typecheck`                            | exit 0                             |
| Lint       | `pnpm lint`                                 | exit 0                             |
| Unit tests | `pnpm turbo run test --filter=walletwright` | all pass                           |
| Landing    | `pnpm --filter landing build`               | exit 0                             |

## Git workflow

- Branch: `improve-housekeeping`.
- Conventional-commit messages per task, e.g. `chore(deps): override tar to ^7.5.16`,
  `ci: align react-doctor to checkout@v6`, `chore: drop stale prool release-age exclude`,
  `refactor(engine): single notification-match default`, `docs(landing): note Slush icon fallback`.
- Do NOT push or open a PR unless the operator asks.

---

## Task A: Remove the dev-only `tar` advisories via an override

**Evidence**: `pnpm audit` reports several HIGH `tar` advisories, all transitive via
`packages__walletwright > prool > tar`, all `dev=true`. `prool` is a devDependency and optional peer,
used only by `createLocalChain` (`src/chain.ts`) for local-anvil tests. Not in the published runtime
path.

**Steps**: Add a `pnpm.overrides` entry (root `package.json`) forcing `tar` to a patched version:
`"pnpm": { "overrides": { "tar": "^7.5.16" } }` (check the current patched version with
`pnpm view tar version` first). Alternatively, if a newer `prool` already pulls a patched `tar`, bump
`prool` instead. Run `pnpm install`.

**Verify**: `pnpm audit` no longer lists the `tar` HIGH advisories; `pnpm turbo run test
--filter=walletwright` all pass; `pnpm typecheck` exit 0.

**STOP** if forcing `tar@^7.5.16` breaks `prool` (its tests/usage need an older `tar`): report and
skip Task A.

---

## Task B: Align the CI setup actions

**Evidence**: `.github/workflows/react-doctor.yml:23` uses `actions/checkout@v5` while every other
workflow uses `@v6`. `release.yml` uses `pnpm/action-setup@v6` + `actions/setup-node@v6` while
`build/test/lint/format/typecheck/fallow.yml` use `pnpm/setup@v1`.

**Steps**: Bump `react-doctor.yml` checkout to `@v6`. Do NOT change the `pnpm/setup@v1`-vs-
`action-setup` split unless you first confirm which is intended (the release workflow deliberately
uses the canonical `action-setup`+`setup-node` for npm-publish auth). Minimal safe change: just the
`checkout@v5` -> `@v6` bump. If you want to standardize the setup recipe, note it as a follow-up
rather than doing it blind.

**Verify**: `grep -rn "actions/checkout@" .github/workflows` shows all `@v6`. (Workflow changes are
validated by CI on push; there is no local runner.)

**STOP** if a workflow pins `checkout@v5` for a documented reason (a comment says so): report and skip.

---

## Task C: Drop the stale `minimumReleaseAgeExclude` for `prool`

**Evidence**: `pnpm-workspace.yaml` ends with:

```yaml
minimumReleaseAgeExclude:
  # prool was newer than the release-age gate allowed when adopted (2026-07); drop once it ages out.
  - prool@0.2.10
```

The adoption note says drop once it ages out; the package is now well past the adoption window.

**Steps**: Remove the `minimumReleaseAgeExclude` block (and its comment). Run `pnpm install`.

**Verify**: `pnpm install` completes without re-flagging the release-age gate for `prool`. If it does
re-flag it, the exclusion is still needed, revert (STOP/skip Task C).

---

## Task D: Single source for the `notification.html` default

**Evidence**: the MetaMask/Phantom default popup token is hardcoded in three places:
`controller.ts:26` (`definition.notificationMatch ?? "notification.html"`), and `utils.ts:66` and
`:94` (both `match = "notification.html"` default params). Because `controller.ts` always passes an
explicit `match`, the two `utils.ts` param defaults are unreachable via the real call path.

**Steps**: Define one exported constant (e.g. `export const DEFAULT_NOTIFICATION_MATCH =
"notification.html";` in `utils.ts`) and use it in all three spots, OR drop the `utils.ts` param
defaults and keep the single fallback in `controller.ts`. Keep behavior identical (Slush still
overrides via `notificationMatch: "isPopup=1"`).

**Verify**: `grep -rn '"notification.html"' packages/walletwright/src` returns one definition;
`pnpm typecheck` exit 0; `pnpm lint` exit 0; `pnpm turbo run test --filter=walletwright` all pass.

---

## Task E: Note the Slush landing-icon fallback

**Evidence**: `apps/landing/src/components/wallets.tsx:35` uses `NetworkSui` (the Sui chain icon) as
the Slush WALLET icon, because `@web3icons/react` has no Slush brand mark (the other cards use
`WalletMetamask`/`WalletPhantom`). So the Slush card shows the Sui glyph in both the wallet and chain
slots.

**Steps**: If a Slush brand SVG is readily available, inline it as the wallet icon. Otherwise, add a
short code comment above line 35 explaining the intentional fallback so it is not mistaken for a bug.
Do NOT add a new icon dependency for this.

**Verify**: `pnpm --filter landing build` exit 0; `pnpm --filter landing lint` exit 0.

> Note: if plan 016 (landing MetaMask-Solana) also lands, coordinate so both edits to `wallets.tsx`
> merge cleanly; either order works, just re-run the drift check.

---

## Done criteria

Per-task (mark any skipped with a one-line reason in the PR and in `plans/README.md`):

- [ ] Task A: `pnpm audit` no longer lists the `prool > tar` HIGH advisories (or skipped, reason noted)
- [ ] Task B: all `.github/workflows` checkouts are `@v6` (or skipped, reason noted)
- [ ] Task C: `minimumReleaseAgeExclude` removed and `pnpm install` clean (or skipped, reason noted)
- [ ] Task D: one `"notification.html"` definition remains; tests pass (or skipped, reason noted)
- [ ] Task E: Slush icon replaced or commented (or skipped, reason noted)
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm turbo run test --filter=walletwright` all exit 0
- [ ] No files outside the tasks' touched files are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Per-task STOP conditions are inline above. Skipping a task is fine; do not force any task that trips
its STOP condition.

## Maintenance notes

- Task A/C: revisit `prool` on its next release; if a newer `prool` pulls patched `tar`, prefer
  bumping it over the override.
- Task D: if a new wallet routes approvals through a different default, the single constant is the
  one place to reconsider.
