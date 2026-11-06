import type { WalletKind, WalletSetup } from "@walletwright/core";

const PASSWORD = "Tester@1234";

/** The public Anvil test mnemonic, funded on the local chain. */
const PUBLIC_TEST_SEED = "test test test test test test test test test test test junk";

/** The first account of `PUBLIC_TEST_SEED`. */
export const TEST_ACCOUNT = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";

/**
 * A fresh, unfunded mnemonic. Phantom and Slush block the public one, and Solflare only shows its
 * quick setup, which its onboarding takes, for a seed with no SOL.
 */
const FRESH_SEED = "parade wire fork giggle foil sugar early record crew mesh excuse purse";

export const metamaskSetup: WalletSetup = {
  password: PASSWORD,
  seedPhrase: PUBLIC_TEST_SEED,
  wallet: "metamask",
};

export const solflareSetup: WalletSetup = {
  password: PASSWORD,
  seedPhrase: FRESH_SEED,
  wallet: "solflare",
};

export const rabbySetup: WalletSetup = {
  password: PASSWORD,
  seedPhrase: PUBLIC_TEST_SEED,
  wallet: "rabby",
};

export const phantomSetup: WalletSetup = {
  password: PASSWORD,
  seedPhrase: FRESH_SEED,
  wallet: "phantom",
};

export const slushSetup: WalletSetup = {
  password: PASSWORD,
  seedPhrase: FRESH_SEED,
  wallet: "slush",
};

export const walletSetups = {
  metamask: metamaskSetup,
  phantom: phantomSetup,
  rabby: rabbySetup,
  slush: slushSetup,
  solflare: solflareSetup,
} satisfies Record<WalletKind, WalletSetup>;
