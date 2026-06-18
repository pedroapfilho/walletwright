# walletwright

Playwright wallet automation for **MetaMask (EVM)**, **Phantom (EVM + Solana)**, and **Slush (Sui)**.
It connects and signs in the real browser extensions, and works as a maintained alternative to
Synpress.

- Real extensions, no mocks: MetaMask, Phantom, and Slush on their current versions.
- EVM, Solana, and Sui from one fixture: `window.ethereum`, `window.phantom.solana`, and the Sui
  Wallet Standard.
- Onboard a wallet once into a cached profile, then unlock it and drive the popups in every test.
- Plain `@playwright/test` fixtures, so there is no framework lock-in.

## Install

```sh
pnpm add -D walletwright @playwright/test
pnpm exec playwright install chromium
```

`@playwright/test` is a peer dependency.

## 1. Describe the wallet

```ts
// wallet-setup.ts
import type { WalletSetup } from "walletwright";

export const metamask: WalletSetup = {
  wallet: "metamask",
  seedPhrase: "test test test test test test test test test test test junk",
  password: "Tester@1234",
};
```

> **Phantom and Slush** reject the famous public test seed (Phantom flags it as malicious and drops
> the connection). Use a fresh, unfunded mnemonic for those two.

## 2. Build the cache (once)

```sh
walletwright cache --setup ./wallet-setup.ts
# or: walletwright cache --wallet metamask --seed "YOUR_SEED_HERE" --password "YOUR_PASSWORD_HERE"
```

Or call it from code, which works well as a Playwright global setup:

```ts
import { buildCache } from "walletwright";
import { metamask } from "./wallet-setup.ts";

await buildCache(metamask);
```

## 3. Write a test

```ts
import { createWalletFixtures } from "walletwright";
import { metamask } from "./wallet-setup.ts";

const test = createWalletFixtures(metamask);
const { expect } = test;

test("connect and sign", async ({ page, wallet }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Connect" }).click();
  await wallet.connectToDapp();
  await expect(page.locator("#account")).toContainText("0x");

  await page.getByRole("button", { name: "Sign" }).click();
  await wallet.confirmSignature();
});
```

The `wallet` fixture:

| Method                  | Description                                                                       |
| ----------------------- | --------------------------------------------------------------------------------- |
| `connectToDapp()`       | Approve a pending connection popup. Resolves quietly if the wallet auto-approved. |
| `confirmSignature()`    | Approve a pending signature popup.                                                |
| `approve({ optional })` | Approve any pending popup, whether connect, sign, or a transaction.               |
| `extensionId`           | The loaded extension id.                                                          |

The same two calls drive every chain. A Phantom test can connect and sign on
`window.phantom.ethereum` and then on `window.phantom.solana`; a Slush test does the same on Sui. See
`apps/demo` for a full example.

## Without fixtures

```ts
import { launchWallet } from "walletwright";

const { context, wallet } = await launchWallet(metamask);
const page = await context.newPage();
// drive the page and the wallet here
await context.close();
```

## Requirements and notes

- **Run headed.** Extension approval popups do not open in headless Chromium. On CI, give it a virtual
  display: `xvfb-run pnpm test`. `buildCache` can run headless, since onboarding has no popups.
- MetaMask is pinned to a known-good version (override it with `WalletSetup.version`). Phantom and
  Slush always use the current Web Store build.
- The cache lives in `.walletwright/` (override it with `WalletSetup.cacheDir`). Add that directory to
  `.gitignore`.

## License

MIT
