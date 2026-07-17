import { downloadAndExtractExtension } from "../internal/download.ts";
import { markMetaMaskOnboarded } from "../internal/onboarding-patch.ts";
import type { WalletDefinition } from "../types.ts";

import { accounts } from "./metamask/actions/accounts.ts";
import { network } from "./metamask/actions/network.ts";
import { settings } from "./metamask/actions/settings.ts";
import { approve, reject } from "./metamask/approve.ts";
import { importWallet, reachUnlockScreen, unlock } from "./metamask/onboarding.ts";

const DEFAULT_VERSION = "13.35.1";

export const metamask: WalletDefinition = {
  actions: { accounts, network, settings },
  approve,
  ecosystems: ["evm"],
  extensionName: "MetaMask",

  prepareExtension: (cacheDir, version = DEFAULT_VERSION) =>
    downloadAndExtractExtension({
      cacheDir,
      kind: "zip",
      name: `metamask-chrome-${version}`,
      url: `https://github.com/MetaMask/metamask-extension/releases/download/v${version}/metamask-chrome-${version}.zip`,
    }),

  // Fresh install of home.html redirects to the onboarding welcome screen.
  finalizeCache: markMetaMaskOnboarded,

  importWallet,
  onboardingPage: "home.html",
  reachUnlockScreen,
  reject,
  unlock,
};
