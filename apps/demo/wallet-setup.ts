import type { WalletKind, WalletSetup } from "@walletwright/core";

export const metamaskSetup: WalletSetup = {
  password: "Tester@1234",
  seedPhrase: "test test test test test test test test test test test junk",
  wallet: "metamask",
};

export const solflareSetup: WalletSetup = {
  password: "Tester@1234",
  seedPhrase: "parade wire fork giggle foil sugar early record crew mesh excuse purse",
  wallet: "solflare",
};

export const rabbySetup: WalletSetup = {
  password: "Tester@1234",
  seedPhrase: "test test test test test test test test test test test junk",
  wallet: "rabby",
};

// Phantom flags the famous public test seed as malicious and silently drops connections, so use a
// dedicated (unfunded) mnemonic for Phantom.
export const phantomSetup: WalletSetup = {
  password: "Tester@1234",
  seedPhrase: "parade wire fork giggle foil sugar early record crew mesh excuse purse",
  wallet: "phantom",
};

export const slushSetup: WalletSetup = {
  password: "Tester@1234",
  seedPhrase: "parade wire fork giggle foil sugar early record crew mesh excuse purse",
  wallet: "slush",
};

// Each cache script used to carry its own copy of this list, which is how `solflare` fell out of
// `test:cache` while `solflareTest` kept running: its spec failed on a fresh clone until someone
// cached it by hand. The `WalletKind` key type makes a new wallet fail typecheck until it is added.
export const walletSetups: Record<WalletKind, WalletSetup> = {
  metamask: metamaskSetup,
  phantom: phantomSetup,
  rabby: rabbySetup,
  slush: slushSetup,
  solflare: solflareSetup,
};
