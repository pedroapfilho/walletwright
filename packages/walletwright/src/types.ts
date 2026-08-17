import type { BrowserContext, Locator, Page } from "@playwright/test";

/** Blockchain ecosystem a wallet operates in. A wallet may span several (e.g. Phantom = EVM + SVM). */
export type Ecosystem = "evm" | "svm" | "sui" | "dot" | "btc";

/**
 * Supported wallet extensions. Only wallets with a verified end-to-end (connect + sign) flow are
 * listed. The roadmap (top 3 per ecosystem) is tracked in `AGENTS.md`; each lands here once driven.
 */
export type WalletKind = "metamask" | "phantom" | "rabby" | "slush" | "solflare";

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

/**
 * The wallet-side counterpart of one dapp-facing capability: the same arguments, with the action
 * context threaded in front.
 */
type WalletAction<Method> = Method extends (...args: infer Args) => Promise<void>
  ? (ctx: WalletActionContext, ...args: Args) => Promise<void>
  : never;

/**
 * The wallet-side half of a dapp-facing capability group, derived from that group's `*Api` type on
 * `Wallet` so a capability's name and arguments are written exactly once.
 */
type WalletActionsFor<Api> = { [Name in keyof Api]?: WalletAction<Api[Name]> };

/** Create, import, rename, and switch accounts from the wallet's own UI. */
export type AccountActions = WalletActionsFor<AccountsApi>;

/** A custom EVM network, as the wallet's add-network form expects it. */
export type NetworkConfig = {
  chainId: number;
  name: string;
  rpcUrl: string;
  symbol: string;
};

/** Add a custom network and switch the active one, from the wallet's own UI. */
export type NetworkActions = WalletActionsFor<NetworkApi>;

/** Lock and unlock the wallet itself, from its own UI. */
export type SettingsActions = WalletActionsFor<SettingsApi>;

/** Optional wallet capabilities beyond connect and sign. Undeclared actions throw at call time. */
export type WalletActions = {
  accounts?: AccountActions;
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
  /** Controls that exist only for a pending request, excluding idle wallet UI. */
  approvalControls?: (popup: Page) => Locator;
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
  /** Whether the real wallet exposes approval windows as Playwright pages in headless mode. */
  headlessApprovals?: boolean;
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
  /**
   * Applied to every context this wallet runs in, before anything navigates: `buildCache`'s and
   * `launchWallet`'s alike. For wallets that need the browser itself adjusted (routing, permissions)
   * rather than a page driven.
   */
  prepareContext?: (context: BrowserContext) => Promise<void>;
  /** Download + extract the unpacked extension into `cacheDir`; returns its absolute path. */
  prepareExtension: (cacheDir: string, version?: string) => Promise<string>;
  /**
   * Open the wallet's home/unlock page and return it once it has settled into a known state (its
   * password screen, or an already-unlocked wallet for the wallets that can reopen that way). Throws
   * rather than returning a page that never rendered. The returned page stays open as `Wallet.home`.
   */
  reachUnlockScreen: (context: BrowserContext, extensionId: string) => Promise<Page>;
  /** Click the cancel/reject button in an approval popup, the counterpart of `approve`. */
  reject: (popup: Page) => Promise<void>;
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
  /** MetaMask 13.x switches dapp-scoped networks through `wallet_addEthereumChain` approvals. */
  switch: (chainId: number) => Promise<void>;
};

/** Manage accounts from the wallet's own UI. Throws if the wallet doesn't declare support. */
export type AccountsApi = {
  /** Derive the next HD account from the seed. */
  add: () => Promise<void>;
  importPrivateKey: (privateKey: string) => Promise<void>;
  rename: (options: { index: number; name: string }) => Promise<void>;
  /** Make the account at `index` (order shown in the wallet's account list) the active one. */
  switch: (index: number) => Promise<void>;
};

/** Drives an unlocked wallet against a dapp under test. */
export type Wallet = {
  accounts: AccountsApi;
  /** Approve whatever approval popup is currently pending (connect, sign, tx…). */
  approve: (options?: { optional?: boolean }) => Promise<void>;
  /** Approve a pending signature request popup. */
  confirmSignature: () => Promise<void>;
  /** Approve a pending transaction request popup. */
  confirmTransaction: () => Promise<void>;
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
  /** Reject a pending transaction request popup. */
  rejectTransaction: () => Promise<void>;
  settings: SettingsApi;
};
