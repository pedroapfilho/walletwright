import { downloadAndExtractExtension } from "../internal/download";
import type { WalletDefinition } from "../types";

import { accounts } from "./metamask/actions/accounts";
import { network } from "./metamask/actions/network";
import { settings } from "./metamask/actions/settings";
import { approvalControls, approve, reject } from "./metamask/approve";
import { importWallet, reachUnlockScreen, unlock } from "./metamask/onboarding";
import { markMetaMaskOnboarded } from "./metamask/onboarding-patch";

/**
 * sha256 of each pinned `metamask-chrome-<version>.zip` release asset, so a pinned download is
 * verified rather than trusted. This is the one place to fill in when bumping `DEFAULT_VERSION`:
 *
 *   curl -sL https://github.com/MetaMask/metamask-extension/releases/download/v<v>/metamask-chrome-<v>.zip | shasum -a 256
 *
 * A version a caller pins through `setup.version` has no entry here and downloads unverified, and
 * the Web-Store wallets can't be pinned at all (that endpoint always serves the current version).
 */
const RELEASE_SHA256 = {
  "13.35.1": "4e0f8626df0ae9fb15f5f3ad6784a0b518f3ede067b2b0d4f539f9f457c5049c",
} as const satisfies Readonly<Record<string, string>>;

/**
 * Typed as a key of `RELEASE_SHA256`, so bumping the default without adding its hash above is a
 * compile error. `download.ts` skips verification for an unpinned `sha256`, so the same bump would
 * otherwise silently downgrade every default MetaMask download to unverified.
 */
export const DEFAULT_VERSION: keyof typeof RELEASE_SHA256 = "13.35.1";

const releaseSha256 = (version: string): string | undefined =>
  Object.entries(RELEASE_SHA256).find(([pinned]) => pinned === version)?.[1];

/** Download inputs for a MetaMask release, split out so the integrity wiring is unit-testable. */
export const metamaskDownload = (cacheDir: string, version: string) => ({
  cacheDir,
  kind: "zip" as const,
  name: `metamask-chrome-${version}`,
  sha256: releaseSha256(version),
  url: `https://github.com/MetaMask/metamask-extension/releases/download/v${version}/metamask-chrome-${version}.zip`,
});

/**
 * MetaMask's backup-and-sync restores account names for whichever SRP a profile holds, and test
 * seeds are shared (the public `test test … junk` one by thousands), so a synced profile reports a
 * stranger's account names in place of the ones a test just set: CI runs showed accounts called
 * `dev1` and `personal`, holding a real balance, where `Account 2` was expected. It only happens
 * where the sync actually lands, which makes it look like a flake. MetaMask's own e2e suite mocks
 * its external services for the same reason.
 *
 * Just the one host that stores the names. Cutting the auth stack around it (`authentication`,
 * `oidc`) reaches further than intended: other features authenticate through it too, and a wallet
 * that cannot authenticate can leave a request's confirm button disabled with nothing to explain it.
 */
const ACCOUNT_SYNC_HOST = "user-storage.api.cx.metamask.io";

export const metamask: WalletDefinition = {
  actions: { accounts, network, settings },
  approvalControls,
  approve,
  ecosystems: ["evm", "svm"],
  extensionName: "MetaMask",

  finalizeCache: markMetaMaskOnboarded,

  importWallet,

  onboardingPage: "home.html",

  prepareContext: async (context) => {
    await context.route(`**://${ACCOUNT_SYNC_HOST}/**`, (route) => route.abort());
  },
  prepareExtension: (cacheDir, version = DEFAULT_VERSION) =>
    downloadAndExtractExtension(metamaskDownload(cacheDir, version)),
  reachUnlockScreen,
  reject,
  unlock,
};
