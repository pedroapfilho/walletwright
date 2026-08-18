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

export const walletSetups = {
  metamask: metamaskSetup,
  phantom: phantomSetup,
  rabby: rabbySetup,
  slush: slushSetup,
  solflare: solflareSetup,
} satisfies Record<WalletKind, WalletSetup>;
