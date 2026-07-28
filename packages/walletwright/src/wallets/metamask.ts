import { downloadAndExtractExtension } from "../internal/download";
import type { WalletDefinition } from "../types";

import { accounts } from "./metamask/actions/accounts";
import { network } from "./metamask/actions/network";
import { settings } from "./metamask/actions/settings";
import { approve, reject } from "./metamask/approve";
import { importWallet, reachUnlockScreen, unlock } from "./metamask/onboarding";
import { markMetaMaskOnboarded } from "./metamask/onboarding-patch";

const DEFAULT_VERSION = "13.35.1";

export const metamask: WalletDefinition = {
  actions: { accounts, network, settings },
  approve,
  ecosystems: ["evm", "svm"],
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
