import type { BrowserContext, Page } from "@playwright/test";

/** Blockchain ecosystem a wallet operates in. A wallet may span several (e.g. Phantom = EVM + SVM). */
export type Ecosystem = "evm" | "svm" | "sui" | "dot" | "btc";

/**
 * Supported wallet extensions. Only wallets with a verified end-to-end (connect + sign) flow are
 * listed. The roadmap (top 3 per ecosystem) is tracked in `AGENTS.md`; each lands here once driven.
 */
export type WalletKind = "metamask" | "phantom" | "slush";

/** A wallet to import and the credentials to unlock it. */
export type WalletSetup = {
  /** Cache directory for downloaded extensions and onboarded profiles. Defaults to `.walletwright`. */
  cacheDir?: string;
  password: string;
  /** 12/24-word seed phrase. Avoid the famous public test seed for Phantom, it blocks connections. */
  seedPhrase: string;
  /** Pin a specific extension version (defaults to a known-good version per wallet). */
  version?: string;
  wallet: WalletKind;
};

/**
 * Everything wallet-specific that the generic engine needs. One implementation per wallet lives in
 * `src/wallets/*`.
 */
export type WalletDefinition = {
  /**
   * Click the approve/confirm button in an approval popup (connect or sign). `password` is provided
   * because some wallets (e.g. Slush) re-prompt for it to authorize a signature.
   */
  approve: (popup: Page, password: string) => Promise<void>;
  /** Ecosystems this wallet can drive (e.g. `["evm", "svm"]` for Phantom). */
  ecosystems: ReadonlyArray<Ecosystem>;
  /** Name as it appears in `chrome://extensions` (used to resolve the loaded extension id). */
  extensionName: string;
  /**
   * Optional fix applied to the persisted profile *after* the build context closes (browser not
   * holding the DB), e.g. forcing `completedOnboarding=true` in MetaMask's leveldb.
   */
  finalizeCache?: (profileDir: string, extensionId: string) => Promise<void>;
  /** Run the import-from-seed onboarding flow. */
  importWallet: (page: Page, seedPhrase: string, password: string) => Promise<void>;
  /**
   * URL token that identifies this wallet's approval popup. Defaults to `notification.html`
   * (MetaMask/Phantom). Single-page wallets differ, Slush routes approvals through `index.html` and
   * marks them with `isPopup=1`.
   */
  notificationMatch?: string;
  /** Extension-relative path of the first-run onboarding entry (e.g. `home.html`). */
  onboardingPage: string;
  /** Download + extract the unpacked extension into `cacheDir`; returns its absolute path. */
  prepareExtension: (cacheDir: string, version?: string) => Promise<string>;
  /** Navigate to the home/unlock page and return true once the password screen is rendered. */
  reachUnlockScreen: (context: BrowserContext, extensionId: string) => Promise<Page>;
  /** Unlock the wallet on its (already-open) home page. */
  unlock: (page: Page, password: string) => Promise<void>;
};

/** Drives an unlocked wallet against a dapp under test. */
export type Wallet = {
  /** Approve whatever approval popup is currently pending (connect, sign, tx…). */
  approve: (options?: { optional?: boolean }) => Promise<void>;
  /** Approve a pending signature request popup. */
  confirmSignature: () => Promise<void>;
  /** Approve a pending connection request popup. Resolves quietly if the wallet auto-approved. */
  connectToDapp: () => Promise<void>;
  /** The loaded extension id. */
  readonly extensionId: string;
};
