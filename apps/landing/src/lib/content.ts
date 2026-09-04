/**
 * Product truth the landing page renders from: wallet coverage, spec
 * filenames, code samples, and the captured run output live here once.
 */

const HERO_HEADLINE = "Connect and sign real wallets in Playwright.";

const HERO_BODY =
  "walletwright onboards MetaMask, Phantom, Rabby, Solflare, and Slush from a seed, caches the " +
  "profile, then unlocks and drives the connect and signature popups against your dapp.";

const HERO_CODE = `import { createWalletFixtures } from "@walletwright/core";
import { metamask } from "./wallet-setup";

const test = createWalletFixtures(metamask);
const { expect } = test;

test("connect and sign", async ({ page, wallet }) => {
  await page.goto("/");
  const account = page.locator("#account");

  await page.getByText("Connect").click();
  await wallet.connectToDapp();
  await expect(account).toContainText("0x");

  await page.getByText("Sign").click();
  await wallet.confirmSignature();
});`;

const GREEN = "\u001b[32m";
const RESET = "\u001b[0m";

const pass = (index: number, spec: string, name: string, duration: string) =>
  `  ${GREEN}✓${RESET}  ${index} [chromium] › tests/${spec} › ${name} (${duration})`;

/*
 * A real local run against the demo dapp, minus Playwright's dim (SGR 2) runs:
 * shiki renders those at 50% alpha, which fails WCAG AA on the light theme.
 * Re-capture it rather than editing timings by hand if this goes stale.
 */
const RUN_OUTPUT = [
  "$ pnpm exec playwright test metamask.spec.ts phantom.spec.ts rabby.spec.ts solflare.spec.ts",
  "",
  "Running 4 tests using 1 worker",
  "",
  pass(1, "metamask.spec.ts:8:1", "MetaMask: connect wallet and sign a message", "6.5s"),
  pass(2, "phantom.spec.ts:6:1", "Phantom: connect + sign on EVM and Solana", "18.2s"),
  pass(3, "rabby.spec.ts:8:1", "Rabby: connect wallet and sign a message", "5.5s"),
  pass(4, "solflare.spec.ts:6:1", "Solflare: connect + sign on Solana", "4.1s"),
  "",
  `  ${GREEN}4 passed${RESET} (34.7s)`,
].join("\n");

/** Why the captured run shows four wallets while the registry holds five. */
const RUN_CAPTION =
  "Four wallets, one command, real approval popups. The fifth, Slush, signs headed in tests/slush.spec.ts.";

const SETUP_CODE = `// wallet-setup.ts
import type { WalletSetup } from "@walletwright/core";

export const metamask: WalletSetup = {
  wallet: "metamask",
  // Phantom and Slush block this public seed; use a fresh, unfunded mnemonic there.
  seedPhrase: "test test test test test test test test test test test junk",
  password: "Tester@1234",
};`;

type VerifiedPair = {
  ecosystem: "EVM" | "Solana" | "Sui";
  spec: string;
  wallet: string;
};

/** Every wallet × chain pair with a verified end-to-end spec in apps/demo/tests. */
const VERIFIED_PAIRS: Array<VerifiedPair> = [
  { ecosystem: "EVM", spec: "tests/metamask.spec.ts", wallet: "MetaMask" },
  { ecosystem: "Solana", spec: "tests/metamask-solana.spec.ts", wallet: "MetaMask" },
  { ecosystem: "EVM", spec: "tests/phantom.spec.ts", wallet: "Phantom" },
  { ecosystem: "Solana", spec: "tests/phantom.spec.ts", wallet: "Phantom" },
  { ecosystem: "EVM", spec: "tests/rabby.spec.ts", wallet: "Rabby" },
  { ecosystem: "Solana", spec: "tests/solflare.spec.ts", wallet: "Solflare" },
  { ecosystem: "Sui", spec: "tests/slush.spec.ts", wallet: "Slush" },
];

type Feature = {
  description: string;
  title: string;
};

const FEATURES: Array<Feature> = [
  {
    description:
      "The actual MetaMask, Phantom, Rabby, Solflare, and Slush builds, loaded unpacked into Chromium, with no mocked providers.",
    title: "Real extensions",
  },
  {
    description:
      "buildCache imports the seed into a profile on disk once. Tests launch from a copy and only unlock, so every run starts in seconds.",
    title: "Onboard once, cache it",
  },
  {
    description:
      "connectToDapp() and confirmSignature() drive MetaMask, Phantom, Rabby, and Solflare on EVM and Solana, and Slush on Sui, the same way.",
    title: "EVM, Solana, and Sui, one API",
  },
  {
    description:
      "createWalletFixtures returns a @playwright/test test with a wallet fixture. No framework lock-in, you control the Playwright version.",
    title: "Plain Playwright fixtures",
  },
  {
    description:
      "Approval popups open headed, so run under xvfb on CI. Cache building can run headless, and a couple of retries keeps runs stable.",
    title: "CI-ready, headed",
  },
  {
    description:
      "Built on current wallet and Chromium versions, with no fork and no dependency overrides to maintain.",
    title: "Current versions, no fork",
  },
];

const SETUP_BODY =
  "Describe the wallet once, then build the cached profile with walletwright cache or " +
  "buildCache(). Every test launches from a copy and unlocks in seconds.";

const COVERAGE_BODY =
  "One wallet fixture drives all five. It connects and signs on window.ethereum, the Solana " +
  "Wallet Standard, and the Sui Wallet Standard, so your tests never branch per chain.";

const CLOSE_HEADLINE = "Write your first connect-and-sign test.";

const CLOSE_BODY =
  "The getting-started guide covers install, wallet setup, the cache build, and the first spec.";

export {
  CLOSE_BODY,
  CLOSE_HEADLINE,
  COVERAGE_BODY,
  FEATURES,
  HERO_BODY,
  HERO_CODE,
  HERO_HEADLINE,
  RUN_CAPTION,
  RUN_OUTPUT,
  SETUP_BODY,
  SETUP_CODE,
  VERIFIED_PAIRS,
};
export type { Feature, VerifiedPair };
