# 023 notes: Wallet-Standard mock (design spike)

Status: prototype working. Connect + sign verified headless on Solana against a real Wallet-Standard
client (`@wallet-standard/app`), signing with a real ed25519 key that verifies. This is a spike; the
public API is NOT finalized.

## What was built

- `packages/walletwright/src/mock-standard.ts`: a headless Wallet-Standard fake, isolated from the
  EVM `mock.ts`. It hand-rolls the Wallet-Standard registration protocol in an init script (no
  browser-side library), announces one account, and answers `standard:connect`, `standard:events`,
  and `solana:signMessage`. ed25519 signing runs Node-side over the same `exposeFunction` bridge the
  EVM mock uses.
- `apps/demo/tests/mock-standard.proof.ts` plus `apps/demo/playwright.proof.config.ts`: the throwaway
  proof. Named `.proof.ts` (not `.spec.ts`) and run through a separate config, so the default
  `test:e2e` and CI never pick it up. It drives the demo's SVM section (`#mmSvmConnect`,
  `#mmSvmSign`), asserts the base58 address and a 64-byte signature, then re-verifies the ed25519
  signature Node-side against the announced public key.

Run the proof:

```
pnpm --filter demo exec playwright test -c playwright.proof.config.ts
```

## How the client contract was learned

From `apps/demo/src/wallet-standard.ts` and `apps/demo/src/main.ts` (the SVM and Sui handlers), a
connect+sign flow touches exactly:

- Discovery: `@wallet-standard/app`'s `getWallets().get()`, which relies on the register handshake
  (`wallet-standard:register-wallet` dispatched by the wallet plus `wallet-standard:app-ready`
  dispatched by the app). The wallet must register on both edges, same as a real wallet's
  `registerWallet()`.
- `standard:connect` returns `{ accounts: [{ address, publicKey, chains, features }] }`.
- Per ecosystem: `solana:signMessage(...inputs)` returns `[{ signedMessage, signature: Uint8Array }]`;
  `sui:signPersonalMessage({ account, message })` returns `{ signature: string }`.
- A wallet is matched by `wallet.chains` (`solana:*` / `sui:*`); the demo's SVM handler additionally
  filters `name === "MetaMask"`, which is why the proof names the mock "MetaMask".

## Proposed API shape (open, not final)

Two options considered:

1. New subpath `walletwright/mock-standard` with `installMockStandardWallet(target, { ecosystem })`.
   Keeps the EVM mock (`walletwright/mock`, viem/secp256k1) and the Wallet-Standard mock
   (ed25519/blake2b) in separate entry points, so a dapp test only pulls the crypto it needs. This is
   what the prototype does.
2. One `installMockWallet(target, { ecosystem })` that branches EVM vs Wallet-Standard. Rejected for
   the spike: it would change `mock.ts` behavior (out of scope) and couple the EVM and non-EVM crypto
   into one entry point.

Recommendation: keep them separate (option 1). Current prototype signature:

```ts
installMockStandardWallet(
  target: BrowserContext | Page,
  options?: { ecosystem?: "svm"; name?: string; seedHex?: string },
): Promise<{ address: string; publicKeyHex: string }>
```

Open naming questions: `mock-standard` vs `mock/solana` plus `mock/sui`; whether `installMockWallet`
should re-export it; whether `ecosystem` should instead be `chain` (e.g. `solana:devnet`) so the
announced `chains` array is caller-controlled.

## Signer, per ecosystem

- EVM (existing `mock.ts`): viem `privateKeyToAccount`, secp256k1, `personal_sign`.
- SVM (this prototype): ed25519 via Node's built-in `crypto`, no new dependency. Derive from a
  32-byte seed by wrapping it in the fixed Ed25519 PKCS8 prefix (`createPrivateKey`), read the raw
  public key from the SPKI export, `sign(null, message, key)` for a real 64-byte signature. Solana
  address = base58 of the public key (a ~20-line encoder in the prototype, no dependency). Verified:
  the proof re-checks the signature with `crypto.verify`.
- SUI (not built): Sui also uses ed25519, so signing reuses the same Node primitive. The gap is
  encoding, not signing:
  - Address = first 32 bytes of `blake2b256(flag=0x00 || publicKey)`, hex with `0x` prefix. Node's
    `crypto` has no blake2b256 (only `blake2b512`), so this needs a hash dependency.
  - `sui:signPersonalMessage` expects the message wrapped as a BCS `PersonalMessage` intent before
    signing, and returns a base64 `serializedSignature` = `flag || signature || publicKey`. That is
    more envelope logic than Solana's raw-bytes signature.

## Optional-peer implications

- The EVM mock already makes `viem` an optional peer, gated to the `./mock` subpath. The
  Wallet-Standard mock should be the same: its own subpath, and any crypto dependency it needs stays
  out of the extension-driving core (`index`).
- The SVM prototype adds ZERO dependencies (Node `crypto` plus a hand-rolled base58), so
  `walletwright/mock-standard` for Solana could ship with no new optional peer at all.
- `@wallet-standard/app` is a demo/client dependency, not a mock dependency. The mock hand-rolls the
  registration events, so it does not pull the Wallet-Standard packages into `walletwright`.

## Open questions

1. **Sui needs a blake2b256 dependency.** Node `crypto` lacks it. Candidates already present
   transitively in the monorepo: `@noble/hashes` (blake2b) and `blakejs`. Adding one as an optional
   peer for the Sui mock is the main packaging decision. Pulling it silently was avoided per the plan.
   Solana ships without it; Sui does not.
2. **Sui signature envelope.** `sui:signPersonalMessage` needs BCS intent-message wrapping and the
   `flag || sig || pubkey` base64 serialization. Worth confirming against a real Slush signature that
   the demo's `sui:signPersonalMessage` consumer accepts the mock's output (the demo only displays it;
   a stricter dapp verifying on-chain would need the exact envelope).
3. **base58: hand-roll vs `bs58`.** The prototype hand-rolls ~20 lines to stay dependency-free.
   `bs58` (already transitive) is the alternative; the tradeoff is a tiny bit of owned code vs another
   optional peer.
4. **Multi-account / events.** The prototype announces one account and a no-op `standard:events.on`.
   Real flows may listen for `change` events (account/chain switch). Out of scope for connect+sign,
   but a fuller mock would implement it.
5. **`name` filter coupling.** The demo's SVM handler filters `name === "MetaMask"`; the Sui handler
   does not. If the mock is meant to stand in for a specific wallet, `name` matters; a generic default
   ("Walletwright Mock") only works against name-agnostic clients.
6. **Where the proof lives.** Kept as `.proof.ts` plus a separate config to stay out of CI. If this
   graduates, it becomes a real `.spec.ts` and the demo could add a neutral (name-agnostic) SVM
   section so the mock does not have to impersonate MetaMask.

## Scope respected

- `packages/walletwright/src/mock.ts` unchanged; EVM behavior untouched (its 7 unit tests still pass).
- No public API finalized; no new dependency added; proof excluded from CI.
