# Open decisions

Choices about walletwright that nobody has made yet. Each entry says what the code does today, why
the choice is open, the options, and a recommendation. Delete an entry once it is decided and done.

Last checked against `@walletwright/core` 0.8.0.

## One headless fact per wallet, or one for the build and one for the run

**Today.** Each wallet declares a single `headless: boolean` in its definition
(`packages/walletwright/src/wallets/*.ts`, typed in `packages/walletwright/src/internal/definition.ts`).
It covers onboarding and approvals together. `openSession`
(`packages/walletwright/src/internal/session.ts`) throws before a browser opens when a caller asks
for headless and the wallet says `false`, so `buildCache`, `walletwright cache --headless` and
`launchWallet` all refuse MetaMask, Solflare and Slush by name. The fixtures
(`packages/walletwright/src/fixtures.ts`) launch those three headed whatever Playwright's `headless`
says. Consumers read the fact as `walletInfo[kind].headless`. Phantom and Rabby are `true`.

**Why it is open.** The three refusals have different reasons:

- Slush fails both ways: its onboarding does not get past the welcome screen headless, and its
  approvals have never been reached headless.
- MetaMask and Solflare need a window for approvals, but their onboarding works headless on macOS:
  a profile built headless there passed the headed specs. On a GitHub-hosted runner a MetaMask
  profile built headless is cached broken (item 1 in `AGENTS.md`).

So the single fact refuses a MetaMask or Solflare headless build that would have worked on a
developer machine.

**Options.**

1. Keep one fact. A wallet that needs a display to run needs one to build, so the refusal costs
   nothing on a machine that can run the suite, and `headless` means the same thing everywhere.
2. Two facts, one for the build and one for the run. `WalletInfo` gains a field (or `headless` is
   renamed, which breaks consumers), `openSession` has to be told which phase it is opening for, and
   the MetaMask build fact would have to be `false` anyway because of the runner bug, unless the
   fact also varies by platform. Only Solflare could gain.

**Recommendation.** Option 1. The only winner of option 2 is a headless Solflare build, on a machine
that still needs a display for the run that follows.

**Know first, if option 2 is wanted.** Whether a Solflare profile built headless on a GitHub-hosted
runner works afterwards. On a branch, set Solflare's `headless` to `true`, build its cache with
`walletwright cache --headless --wallet solflare` in the `wallets` job of
`.github/workflows/e2e.yml`, and see whether `apps/demo/tests/solflare.spec.ts` passes from it under
xvfb.

**Once decided.** If option 1 stands, this entry goes and the 1.0.0 decision below has nothing left
to wait for.

## When the package becomes 1.0.0

**Today.** The package is at 0.8.0 and ships breaking changes as minor releases
(`packages/walletwright/CHANGELOG.md`: 0.3.0, 0.5.0 and 0.8.0 carry breaking notes). The public API
is what `packages/walletwright/src/index.ts` exports (`buildCache`, `launchWallet`,
`createWalletFixtures`, `walletInfo`, `walletKinds`, `isWalletKind` and the types), the
`walletwright cache` command, and the `./mock` and `./mock-standard` entry points. Since 0.8.0 none
of the engine's internals are exported, which is what most of the earlier breaking notes were about.

**Why it is open.** On 0.x a consumer's `^0.8.0` range accepts only 0.8.x, so every minor release
needs a manual bump, breaking or not, and the version number cannot tell the two apart. Moving to
1.0.0 fixes that and commits the project to a major for every later break.

**Options.**

1. Stay on 0.x. Breaking changes stay cheap to ship; consumers keep reading the changelog on every
   minor.
2. Release 1.0.0. It needs no code change: one changeset marked `major`. Afterwards a new wallet or
   ecosystem is a minor, and a removed export, a renamed `WalletInfo` field or a changed CLI flag is
   a major.

**Recommendation.** Option 2, in the first release after the headless decision above is settled.
That decision is the only known change that could still rename a public field.

**Know first.** What counts as the contract besides the exports. Two things have been treated as
breaking so far and should be decided once: the wording of `[walletwright]` error messages (0.8.0
listed a reworded refusal as breaking), and the layout of the cache directory (0.7.0 renamed Web
Store archives, which invalidated cached profiles).

**Once decided.** The changelog stops needing a **Breaking** label inside minor releases.

## What wallet actions return

**Today.** Every action in `AccountsApi`, `NetworkApi` and `SettingsApi`
(`packages/walletwright/src/types.ts`) returns `Promise<void>`. Only MetaMask declares them. To
check that an action did something, the demo's own specs read MetaMask's UI through `wallet.home`:
`apps/demo/tests/metamask-accounts.spec.ts` opens the account menu by test id and looks for a
shortened address, and `apps/demo/tests/metamask-actions.spec.ts` looks for the password field that
`packages/walletwright/src/internal/unlock-screen.ts` already knows how to find.

**Why it is open.** A return value is public API, and its shape is a product choice: an address, a
name, an index, or all three. MetaMask's menu shows shortened addresses, so returning a full address
means driving its account-details screen, verified against the real extension.

**Options.**

1. Leave them as they are. A dapp test asserts on the dapp, which shows the connected account; only
   this repo's specs need to look inside the wallet.
2. Return what the action produced: `accounts.add()` and `accounts.importPrivateKey()` resolve to
   `{ address, name }`.
3. Add reads beside the actions: `accounts.list()` and `settings.isLocked()`. Nothing existing
   changes its return type.

**Recommendation.** Option 1 until a second wallet declares `accounts` or a user asks. A shape
designed now would be modelled on MetaMask alone. If something is added, option 3's
`settings.isLocked()` is the smallest useful piece, since the engine already has the check.

**Once decided.** With option 2 or 3 the two demo specs stop using MetaMask's test ids.

## Whether the landing page reads wallet facts from the package

**Today.** `apps/landing/src/lib/content.ts` lists seven wallet and ecosystem pairs by hand
(`VERIFIED_PAIRS`), each with the spec file that verifies it. The same facts live in the wallet
definitions, and the package exports them as `walletInfo`. The landing page cannot import that: the
package root loads `@playwright/test` (`fixtures.ts`, `internal/session.ts`, `internal/click.ts`,
which every wallet file imports) and `classic-level` (MetaMask's storage module). `apps/landing`
does not depend on the package at all.

**Why it is open.** Making the facts importable means a new public entry point, which is a name to
support from then on, and it ties the landing build to the package build.

**Options.**

1. Add an entry point such as `@walletwright/core/wallets` holding each wallet's name, ecosystems,
   `headless` and `pinnable` as a plain table with no Playwright import, and have the definitions
   read from it. `apps/landing` gains a workspace dependency on the package. The page still needs
   its hand-written spec path per pair, so this removes the wallet and ecosystem names from the
   list, not the list.
2. Keep the seven hand-written pairs. They change only when a wallet is added, which already means
   editing the landing and docs copy.

**Recommendation.** Option 2 until something else needs the facts without Playwright (a docs
component, a third-party tool).

**Know first, if option 1 is wanted.** The landing project's build command on Vercel (Project
Settings, Build and Deployment). If it runs `next build` inside `apps/landing` it has to become a
turbo build, so the package's `dist` exists first.

**Once decided.** With option 1, `VERIFIED_PAIRS` shrinks to a map from wallet and ecosystem to spec
file, and the CLI help, the landing page and any docs table read one source.

## Where the landing page's CSS class allow-list lives

**Today.** The landing page is styled by named classes in `apps/landing/src/app/page.css` (`ref-*`
and `world-*`). The `shadcn/no-unknown-classes` rule rejects any class Tailwind cannot generate, so
the root `oxlint.config.ts` allow-lists 39 of those names in three overrides, one per group of
files. Adding a class to the stylesheet means adding it to the root lint config too.

**Why it is open.** The two lists must change together and sit in different places. Each way of
joining them has a cost, and the stylesheet rarely changes (three commits, the last in September
2026).

**Options.**

1. Keep the list where it is.
2. Have `oxlint.config.ts` read the class names out of `page.css` when it loads, so the stylesheet
   is the only list. The rule stays an error. The lint config then runs code, and a class is allowed
   in every landing file, not only the files that use it.
3. Restyle the landing page with Tailwind utilities and theme tokens and delete the named classes.
   This is a redesign of a live page against `DESIGN.md`, not a lint change.

**Recommendation.** Option 1 while the page is stable. Take option 2 the next time the page gets
more than a class or two.

**Know first, for option 2.** That the fleet's lint rules still pass: `standy check` requires every
`shadcn/*` rule to stay at `error` in every override.

**Once decided.** With option 2 or 3 the three overrides in `oxlint.config.ts` go.

## A library for base58 and ed25519 keys in the Solana mock

**Today.** `@walletwright/core/mock-standard` signs with Node's `crypto` and nothing else.
`packages/walletwright/src/mock/signer.ts` carries a hand-written base58 encoder (about 35 lines,
with known-answer tests) and a PKCS#8 prefix to turn a raw seed into a key Node accepts.
`apps/demo/tests/mock-standard.spec.ts` carries the matching SPKI prefix to verify a signature. The
docs say this entry point needs no extra dependency, and the package's runtime dependencies are
`adm-zip`, `classic-level` and `zod`.

**Why it is open.** A library would replace the encoder and the prefixes, but it changes what every
consumer installs for an entry point most of them never import.

**Options.**

1. Keep the hand-written code.
2. Add `@scure/base` (base58) and `@noble/curves` (ed25519 from raw keys) as dependencies. Every
   install of the package pulls them in.
3. Add them as optional peers, as `viem` is for `./mock`. Users of `mock-standard` then have to
   install them, which breaks its "needs nothing" promise.

**Recommendation.** Option 1 for now, and decide again when the Sui mock is built. Sui addresses
need blake2b-256, which Node does not have (`plans/023-notes.md`), so that work brings a hash
library anyway; choose dependency or optional peer once, for all three.

**Worth knowing.** Node imports a raw ed25519 public key as a JWK with no prefix, so the SPKI prefix
in the demo spec can go without a library. A private key as a JWK needs its public key as well, so
the PKCS#8 prefix stays unless a library replaces it.

**Once decided.** With a library, `encodeBase58`, its tests and both prefixes are deleted.
