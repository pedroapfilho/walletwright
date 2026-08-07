import { downloadAndExtractExtension } from "../internal/download";
import type { WalletDefinition } from "../types";

import { accounts } from "./metamask/actions/accounts";
import { network } from "./metamask/actions/network";
import { settings } from "./metamask/actions/settings";
import { approvalControls, approve, reject } from "./metamask/approve";
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

/**
 * MetaMask's backup-and-sync restores account names, and whatever else it has stored, for whichever
 * SRP a profile holds. Test seeds are shared (the public `test test … junk` one by thousands), so a
 * synced profile reports a stranger's account names in place of the ones a test just set: CI runs
 * showed accounts called `dev1` and `personal`, holding a real balance, where `Account 2` was
 * expected. It only happens where the sync actually lands, which makes it look like a flake.
 *
 * Only the identity stack is cut, so RPC, token, price and security APIs behave normally. MetaMask's
 * own e2e suite mocks its external services for the same reason.
 */
const SYNC_HOSTS = [
  "user-storage.api.cx.metamask.io",
  "authentication.api.cx.metamask.io",
  "oidc.api.cx.metamask.io",
];

export const metamask: WalletDefinition = {
  actions: { accounts, network, settings },
  approvalControls,
  approve,
  ecosystems: ["evm", "svm"],
  extensionName: "MetaMask",

  prepareContext: async (context) => {
    for (const host of SYNC_HOSTS) {
      await context.route(`**://${host}/**`, (route) => route.abort());
    }
  },

  prepareExtension: (cacheDir, version = DEFAULT_VERSION) =>
    downloadAndExtractExtension(metamaskDownload(cacheDir, version)),

  // Fresh install of home.html redirects to the onboarding welcome screen.
  finalizeCache: markMetaMaskOnboarded,

  // No `headlessApprovals`: MetaMask creates its approval window headless but never exposes it as a
  // page, so there is nothing for the engine to find, and it renders its home screen rather than the
  // request when reached any other way.

  importWallet,
  onboardingPage: "home.html",
  reachUnlockScreen,
  reject,
  unlock,
};
