import { downloadAndExtractExtension } from "../internal/download";
import type { WalletDefinition } from "../types";

import { accounts } from "./metamask/actions/accounts";
import { network } from "./metamask/actions/network";
import { settings } from "./metamask/actions/settings";
import { approve, reject } from "./metamask/approve";
import { importWallet, reachUnlockScreen, unlock } from "./metamask/onboarding";
import { markMetaMaskOnboarded } from "./metamask/onboarding-patch";

const DEFAULT_VERSION = "13.35.1";

/**
 * sha256 of each pinned `metamask-chrome-<version>.zip` release asset, so a pinned download is
 * verified rather than trusted. This is the one place to fill in when bumping `DEFAULT_VERSION`:
 *
 *   curl -sL https://github.com/MetaMask/metamask-extension/releases/download/v<v>/metamask-chrome-<v>.zip | shasum -a 256
 *
 * A version a caller pins through `setup.version` has no entry here and downloads unverified, and
 * the Web-Store wallets can't be pinned at all (that endpoint always serves the current version).
 */
const RELEASE_SHA256: Readonly<Record<string, string>> = {
  "13.35.1": "4e0f8626df0ae9fb15f5f3ad6784a0b518f3ede067b2b0d4f539f9f457c5049c",
};

/** Download inputs for a MetaMask release, split out so the integrity wiring is unit-testable. */
export const metamaskDownload = (cacheDir: string, version: string) => ({
  cacheDir,
  kind: "zip" as const,
  name: `metamask-chrome-${version}`,
  sha256: RELEASE_SHA256[version],
  url: `https://github.com/MetaMask/metamask-extension/releases/download/v${version}/metamask-chrome-${version}.zip`,
});

export const metamask: WalletDefinition = {
  actions: { accounts, network, settings },
  approve,
  ecosystems: ["evm", "svm"],
  extensionName: "MetaMask",

  prepareExtension: (cacheDir, version = DEFAULT_VERSION) =>
    downloadAndExtractExtension(metamaskDownload(cacheDir, version)),

  // Fresh install of home.html redirects to the onboarding welcome screen.
  finalizeCache: markMetaMaskOnboarded,

  importWallet,
  onboardingPage: "home.html",
  reachUnlockScreen,
  reject,
  unlock,
};
