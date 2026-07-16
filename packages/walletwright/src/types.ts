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
 * Everything an action needs to drive the wallet's own UI (as opposed to an approval popup). Passed
 * as one object so a new dependency doesn't churn every wallet's action signatures.
 */
export type WalletActionContext = {
  context: BrowserContext;
  extensionId: string;
  /** The wallet's own extension page, kept open after unlock. */
  home: Page;
  password: string;
};

/** A custom EVM network, as the wallet's add-network form expects it. */
export type NetworkConfig = {
  blockExplorerUrl?: string;
  chainId: number;
  name: string;
  rpcUrl: string;
  symbol: string;
};

/** Add a custom network and switch the active one, from the wallet's own UI. */
export type NetworkActions = {
  add?: (ctx: WalletActionContext, config: NetworkConfig) => Promise<void>;
  switch?: (ctx: WalletActionContext, chainId: number) => Promise<void>;
};

/** Lock and unlock the wallet itself, from its own UI. */
export type SettingsActions = {
  lock?: (ctx: WalletActionContext) => Promise<void>;
  unlock?: (ctx: WalletActionContext) => Promise<void>;
};

/**
 * Optional, per-wallet capabilities beyond the universal connect/sign flow. A wallet declares only
 * what has actually been driven against the real extension, so the registry never claims support it
 * doesn't have: `network` is meaningless for Slush (Sui), and Phantom's settings UI has no analogue
 * for much of MetaMask's. Anything undeclared throws a clear error at call time.
 */
export type WalletActions = {
  network?: NetworkActions;
  settings?: SettingsActions;
};

/**
 * Everything wallet-specific that the generic engine needs. One implementation per wallet lives in
 * `src/wallets/*`.
 */
export type WalletDefinition = {
  /** Optional capabilities beyond connect/sign. Omit a group the wallet can't (or doesn't) drive. */
  actions?: WalletActions;
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
  /**
   * Click the cancel/reject button in an approval popup, the counterpart of `approve`. Optional:
   * a wallet declares it only once it has been driven against the real extension.
   */
  reject?: (popup: Page) => Promise<void>;
  /** Unlock the wallet on its (already-open) home page. */
  unlock: (page: Page, password: string) => Promise<void>;
};

/** Lock and unlock the wallet from its own UI. Throws if the wallet doesn't declare support. */
export type SettingsApi = {
  lock: () => Promise<void>;
  unlock: () => Promise<void>;
};

/** Add and switch networks from the wallet's own UI. Throws if the wallet doesn't declare support. */
export type NetworkApi = {
  add: (config: NetworkConfig) => Promise<void>;
  switch: (chainId: number) => Promise<void>;
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
  /**
   * The wallet's own extension page, kept open after unlock. Named `home` rather than `page` because
   * `page` already means the dapp under test in every spec.
   */
  readonly home: Page;
  network: NetworkApi;
  /** Reject whatever approval popup is currently pending (connect, sign, tx…). */
  reject: (options?: { optional?: boolean }) => Promise<void>;
  /** Reject a pending connection request popup. */
  rejectConnection: () => Promise<void>;
  /** Reject a pending signature request popup. */
  rejectSignature: () => Promise<void>;
  settings: SettingsApi;
};
