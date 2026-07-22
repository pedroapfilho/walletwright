import type { WalletSetup } from "walletwright";

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
