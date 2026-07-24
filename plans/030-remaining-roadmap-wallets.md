# Plan 030: Remaining roadmap wallets, triage + resumable discovery notes

> **Executor instructions**: EMPIRICAL SPIKE + BUILD, one wallet per PR. A wallet enters `WalletKind`
> and the registry ONLY once its connect and sign are verified end to end against the real extension,
> headed (AGENTS.md). Everything below is discovery already done for you, so you can skip straight to
> driving the flow. Never guess a selector that isn't recorded here: re-snapshot it.

## Status

- **Priority**: P3
- **Effort**: L (one M-sized spike per wallet)
- **Risk**: LOW (additive; nothing enters the registry unverified)
- **Depends on**: none
- **Planned at**: 2026-07-22, after shipping Rabby (024) and Solflare (028)

## Why this matters

The roadmap targets the top 3 wallets per ecosystem. MetaMask, Phantom, Rabby, Solflare, and Slush
are verified. This plan records the triage of every remaining candidate so the next executor spends
its time driving flows rather than rediscovering ids, entry points, and dead ends.

## How to discover a wallet (the loop that worked)

1. Download the CRX (`prepareWebStoreExtension` pattern) and read `manifest.json`: `manifest_version`,
   whether a `key` exists (no key means a path-derived id, see `internal/utils.ts`), and the list of
   root `.html` pages. The approval page is usually obvious from that list.
2. Launch headed with a throwaway profile, navigate to the onboarding page, and snapshot each screen:
   every `button`/`[role=button]` with its `data-testid` and `disabled`, every `input` with its
   `placeholder`/`type`/`data-testid`, plus `location.hash` and a slice of `body.innerText`.
3. Drive the import flow to completion, then relaunch from the built cache to find the unlock screen.
4. Connect from `apps/demo` and snapshot the approval popup; note the URL token that distinguishes it
   (that is `notificationMatch`) and the confirm/cancel controls.
5. Only then write the `WalletDefinition`, register it, and verify with a headed spec.

## Triage: extensions pulled and inspected

All ids below are the Chrome Web Store ids. Every candidate ships without a manifest `key` except
Trust, so its loaded-unpacked id is path-derived and changes if the cache path changes.

| Wallet      | Eco     | Store id                           | MV  | Version  | Manifest `key` | Approval page (likely)     |
| ----------- | ------- | ---------------------------------- | --- | -------- | -------------- | -------------------------- |
| Coinbase    | evm     | `hnfanknocfeofbddgcijnmhnfnkdnaad` | 3   | 3.141.1  | no             | `index.html` + query       |
| Trust       | evm     | `egjidjbpglichdcondbcbdnbeeppgdph` | 3   | 2.91.2   | **yes**        | `popup.html` / `home.html` |
| OKX         | evm+svm | `mcohilncbfahbmgdjkbpemcciiolgcge` | 3   | 4.9.9    | no             | `notification.html`        |
| Solflare    | svm     | `bhhhlbepdkbapadjdnnojkbgioiodbic` | 3   | 2.31.0   | no             | `confirm_popup.html`       |
| Backpack    | svm     | `aflkmfhebedbjioipglgcbcmnbpgliof` | 3   | 0.10.209 | no             | `popout.html`              |
| Nightly     | sui     | `fiikommddbeccaoicoejoniammnalkfa` | 3   | 1.49.48  | no             | `popup.html`               |
| Polkadot.js | dot     | `mopnmbcafieddcagagdcbnhejhlodfdd` | 3   | 0.63.1   | no             | `notification.html`        |
| Talisman    | dot     | `fijngjgcjhjmmpcmkeiomlglpeiijkld` | 3   | 3.7.1    | no             | `popup.html`               |
| Xverse      | btc     | `idnnbdplmphpflfnlkomgpfbpcgelopg` | 3   | 2.5.6    | no             | `popup.html`               |
| UniSat      | btc     | `ppbibelpcjmhbdihakflkdcoccbgbkpo` | 3   | 1.7.17   | no             | `notification.html`        |

**Suiet is unavailable**: its Web Store CRX download returns a non-CRX payload (delisted, or the id
changed). Re-check the id before planning it; Nightly is the better SUI target meanwhile.

Solflare shipped from this triage (plan 028). The rest are below.

## Per-wallet notes

### Coinbase Wallet (EVM): BLOCKED, fully discovered

Everything below is confirmed working when driven from a standalone script, and the cache builds.
The blocker is at the dapp boundary, not in the wallet UI.

- Onboarding (`index.html`): `btn-import-existing-wallet`, then `btn-import-recovery-phrase`, then
  fill `secret-input` with the whole phrase, then click the **"Acknowledge"** scam notice (it keeps
  the footer disabled), then `btn-import-wallet`, then `setPassword` + `setPasswordVerify` + check
  `terms-and-privacy-policy`, then `btn-password-continue`. It lands on the portfolio
  (`portfolio-navigation-link`). The public `test … junk` seed is accepted.
- A restored profile reopens **already unlocked**, so `reachUnlockScreen` must accept the portfolio as
  a ready state and `unlock` must no-op when no password field is present.
- Approvals reuse `index.html` with an `extensionUIRequest` query (there is no `notification.html`),
  so `notificationMatch: "extensionUIRequest"`. Connect confirms with `allow-authorize-button`
  (cancel `deny-authorize-button`); signing confirms with `sign-message` (cancel `cancel-message`).
- **The blocker**: driven through the Playwright wallet fixture, `eth_requestAccounts` never settles.
  No popup opens, no error reaches the dapp, and `#accounts` stays empty. The identical cached profile
  driven by a standalone script opens the popup reliably every time.
- Ruled out: provider injection (`window.ethereum` is Coinbase, alongside `coinbaseWalletExtension`),
  `closeStrayPages` in `internal/launch.ts` (the working case reproduces with strays closed), bringing
  the dapp to front before the request, closing the wallet home page, and inline rendering in the home
  tab (the home page still shows the portfolio).
- Next thing to try: diff the launch flags and page-creation order between `internal/launch.ts` and a
  standalone script, and check whether Coinbase keys anything off the originating tab id (its popup
  URL carries `originTabId`).

### Backpack (SVM): partially discovered

- Onboarding page is `onboarding.html`.
- The Terms control (`terms-of-service-checkbox`) is **not "visible" to Playwright** (zero-size or
  fully styled input), so it needs `click({ force: true })`; a visibility gate skips it silently and
  the flow then refuses to advance. Clicking its _label text_ instead opens the external terms site
  and navigates the onboarding page away.
- Confirmed so far: force-click terms, then **"I already have a wallet"**, then a **"Select a
  network"** screen (Solana, Ethereum, Sui, Aptos, Bitcoin, and more), then pick **"Solana"**, after
  which a **"Recovery phrase"** option is present.
- Still to discover: the seed-entry screen, password screen, completion, unlock, and the approval
  popup (`popout.html` is the likely window; confirm the URL token).
- Once verified it can reuse the demo's name-agnostic Wallet-Standard Solana section
  (`#mockSvmConnect` / `#mockSvmSign`), exactly as Solflare does, so **no dapp changes are needed**.

### Trust Wallet (EVM): not started

- The only candidate here that **ships a manifest `key`**, so its extension id is fixed
  (`egjidjbpglichdcondbcbdnbeeppgdph`) rather than path-derived, like Phantom.
- Root pages are `home.html`, `popup.html`, `sidepanel.html`. Start onboarding at `home.html`.
- Reuses the demo's existing EVM section (`#connectButton` / `#signButton`), so no dapp work.

### OKX Wallet (EVM + SVM): not started, added 2026-07-24 on usage grounds

- Added to the triage because it outranks several listed candidates by extension usage (strong
  outside the US) and drives both ecosystems the demo already has sections for, so one wallet
  verifies two rows of the roadmap table with **no dapp changes**.
- CRX pulled and manifest read 2026-07-24 (row above): MV3, no `key` (path-derived id). Root pages
  include `home.html` (likely onboarding entry) and a standard `notification.html` (likely approval
  page, same shape as MetaMask/Phantom).
- **Caveat before driving it**: the bundle ships `ses.html` / `ses-sandbox.html`, so OKX likely
  hardens its pages with SES the way MetaMask does with LavaMoat (item 12 in AGENTS.md). Expect
  `page.evaluate` to be blocked inside the wallet's own pages; plan on locators from the start.
- Still to discover: the whole onboarding flow, unlock, and both approval popups.

### Nightly (SUI): not started

- Root pages include `popup.html`, `options.html`, `extension-popup-root.html`. Try `options.html`
  first for onboarding.
- The demo's SUI section is generic Wallet Standard (it matches any wallet advertising a `sui:` chain),
  so with Nightly loaded and Slush absent it resolves Nightly with **no dapp changes**.
- Best remaining SUI target given Suiet's CRX is unavailable.

### Polkadot and Bitcoin: blocked on dapp support, not on the wallets

Neither ecosystem has a section in `apps/demo`, and connect/sign cannot be verified without one. Do
the dapp work first, as its own PR, then the wallets:

- **DOT**: wallets inject `window.injectedWeb3`. Polkadot.js is the reference implementation and
  usefully ships a plain `notification.html` approval page. A demo section needs
  `@polkadot/extension-dapp` (`web3Enable`, `web3Accounts`, `web3FromSource().signer.signRaw`).
- **BTC**: there is no standard. Each wallet injects its own provider (`window.unisat`,
  `window.XverseProviders`), so the demo needs one section per wallet, or a small adapter. UniSat's
  `signMessage` is the simplest first target and it ships `notification.html`.

## Suggested order

1. Nightly (SUI) and Trust (EVM): both reuse existing demo sections, so they are pure wallet work.
2. OKX (EVM + SVM): also pure wallet work, and one verification covers two ecosystems.
3. Backpack (SVM): resume from the network-picker step above.
4. Coinbase (EVM): a debugging task, not a discovery task. Start from the ruled-out list.
5. DOT dapp section, then Polkadot.js, then Talisman. Then BTC dapp section, UniSat, Xverse.

## Done criteria

Per wallet, the criteria match plans 024 and 028:

- [ ] `<wallet>.ts` exists and is registered; `WalletKind` includes it
- [ ] `pnpm typecheck` / `pnpm lint` / `pnpm format:check` exit 0
- [ ] `pnpm turbo run test --filter=walletwright` exits 0 (registry + CLI kind list updated)
- [ ] A headed spec passes connect + sign across a couple of runs, with assertions strict enough that
      a silent no-op cannot pass (assert the address shape and the signature length)
- [ ] Docs updated: `wallets.mdx`, the AGENTS.md roadmap table and a "verified" section, landing grid
- [ ] This plan's per-wallet note updated with what was found

## STOP conditions

- Do NOT register a wallet whose connect+sign you could not drive headed. Record the findings here
  instead, the way Coinbase is recorded above.
- If a wallet needs a dapp section that does not exist, build that section as its own PR first.
