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
  /**
   * Pin an extension version. Only wallets downloaded from versioned releases (MetaMask) accept one;
   * the Web Store wallets refuse it rather than silently running whatever build they have.
   */
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
  /** Unlock `home` through the wallet's unlock screen, with the setup's password. */
  unlock: () => Promise<void>;
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

/** Add a custom network from the wallet's own UI. */
export type NetworkActions = WalletActionsFor<NetworkApi>;

/** Lock and unlock the wallet itself, from its own UI. */
export type SettingsActions = WalletActionsFor<SettingsApi>;

/** Optional wallet capabilities beyond connect and sign. Undeclared actions throw at call time. */
export type WalletActions = {
  accounts?: AccountActions;
  network?: NetworkActions;
  settings?: SettingsActions;
};

/** A downloadable extension archive, and the cache directory it unpacks into. */
export type ExtensionArchive = {
  format: "crx" | "zip";
  /** Directory name inside the cache; must differ per version, since a cached one is reused. */
  name: string;
  /**
   * Expected sha256 of the downloaded bytes. Required, and `undefined` only where the bytes genuinely
   * cannot be pinned, so adding a download site forces a decision instead of quietly trusting it.
   */
  sha256: string | undefined;
  url: string;
};

/** Where a wallet's unpacked extension comes from. */
export type ExtensionSource =
  /**
   * A versioned release: `WalletSetup.version` picks one, `defaultVersion` otherwise. `release`
   * returns that version's archive.
   */
  | { defaultVersion: string; kind: "release"; release: (version: string) => ExtensionArchive }
  /**
   * The Chrome Web Store build current at first download, reused from then on. Its bytes cannot be
   * pinned, so a setup that asks for a `version` is refused.
   */
  | { id: string; kind: "webStore" };

/** How the wallet's own page asks for its password, for the shared unlock flow. */
export type UnlockScreen = {
  /** Extension-relative page that renders the unlock screen (e.g. `home.html`). */
  entry: string;
  /** Detect a warm launch that is already unlocked. */
  isUnlocked?: (page: Page) => Promise<boolean>;
  /** Submit the filled password. Defaults to pressing Enter in the field. */
  submit?: (page: Page, field: Locator) => Promise<void>;
};

/** A screen a wallet can put in front of a request, which the engine passes before answering it. */
export type ApprovalScreen = {
  /** Get the approval past this screen. The engine runs it at most once per approval. */
  pass: (popup: Page) => Promise<void>;
  /** Whether the screen is up right now. Checked on every pass over the window, so it must not wait. */
  shows: (popup: Page) => Promise<boolean>;
};

/** How the engine clicks a control in the approval window. */
export type ApprovalClick =
  /** Playwright's click, which waits for the control to be actionable. */
  | {
      kind: "locator";
      /** Pause before every click and password entry, for a window that wires handlers after render. */
      settleMs?: number;
    }
  /** A click dispatched inside the page, for a window that unmounts while Playwright waits on it. */
  | { kind: "inPage" };

/**
 * The wallet's approval window, as data the engine drives: it finds and places the window, passes
 * `screens`, re-authenticates through the shared unlock flow when asked for the password, clicks
 * each `confirm` or `cancel` control at most once, and waits for the window to close.
 */
export type ApprovalWindow = {
  /** Every control that rejects a request. */
  cancel: (popup: Page) => Locator;
  /** How the engine clicks `confirm` and `cancel` controls. Defaults to `{ kind: "locator" }`. */
  click?: ApprovalClick;
  /**
   * Every control that approves a request, across all of its screens (Rabby signs with Sign, then
   * Confirm). Together with `cancel` it is how the engine tells a request from the wallet's idle UI.
   */
  confirm: (popup: Page) => Locator;
  /** Whether the window surfaces as a Playwright page headless. Declare it once verified. */
  headless?: boolean;
  /** Screens the wallet can put in front of a request, in the order they are checked. */
  screens?: ReadonlyArray<ApprovalScreen>;
  /**
   * URL token that identifies the window. Defaults to `notification.html` (MetaMask, Phantom, Rabby).
   * Slush routes approvals through `index.html` and marks them with `isPopup=1`.
   */
  urlMatch?: string;
};

/**
 * Everything wallet-specific that the generic engine needs. One implementation per wallet lives in
 * `src/wallets/*`.
 */
export type WalletDefinition = {
  /** Optional capabilities beyond connect/sign. Omit a group the wallet can't (or doesn't) drive. */
  actions?: WalletActions;
  /** The approval window the engine drives for connect, sign, and every other dapp request. */
  approval: ApprovalWindow;
  /** Ecosystems this wallet can drive (e.g. `["evm", "svm"]` for Phantom). */
  ecosystems: ReadonlyArray<Ecosystem>;
  /** Display name, used in step titles and error messages (e.g. `MetaMask`). */
  extensionName: string;
  /**
   * Optional fix applied to the persisted profile *after* the build context closes (browser not
   * holding the DB), e.g. forcing `completedOnboarding=true` in MetaMask's leveldb.
   */
  finalizeCache?: (profileDir: string, extensionId: string) => Promise<void>;
  /** Run the import-from-seed onboarding flow. */
  importWallet: (page: Page, seedPhrase: string, password: string) => Promise<void>;
  /** Extension-relative path of the first-run onboarding entry (e.g. `home.html`). */
  onboardingPage: string;
  /**
   * Applied to every context this wallet runs in, before anything navigates: `buildCache`'s and
   * `launchWallet`'s alike. For wallets that need the browser itself adjusted (routing, permissions)
   * rather than a page driven.
   */
  prepareContext?: (context: BrowserContext) => Promise<void>;
  /** Where the extension is downloaded from. */
  source: ExtensionSource;
  /** The wallet's password screen. Its page stays open after unlock as `Wallet.home`. */
  unlockScreen: UnlockScreen;
};

/** Lock and unlock the wallet from its own UI. Throws if the wallet doesn't declare support. */
export type SettingsApi = {
  lock: () => Promise<void>;
  unlock: () => Promise<void>;
};

/**
 * Add networks from the wallet's own UI. Throws if the wallet doesn't declare support. Switching is
 * dapp-initiated: the dapp calls `wallet_addEthereumChain` and `wallet.approve()` confirms it.
 */
export type NetworkApi = {
  add: (config: NetworkConfig) => Promise<void>;
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

/**
 * Drives an unlocked wallet against a dapp under test. The request-named methods
 * (`connectToDapp`, `confirmSignature`, …) are aliases of `approve`/`reject` that read well in a spec
 * and match Synpress's vocabulary; none of them checks what kind of request the popup holds.
 */
export type Wallet = {
  accounts: AccountsApi;
  /** Approve whatever approval popup is currently pending (connect, sign, tx…). */
  approve: (options?: { optional?: boolean }) => Promise<void>;
  /** Approve a pending signature request popup. */
  confirmSignature: () => Promise<void>;
  /** Approve a pending transaction request popup. */
  confirmTransaction: () => Promise<void>;
  /**
   * Approve a pending connection request popup. Pass `{ optional: true }` for a site the wallet may
   * already trust, where connecting produces no popup at all.
   */
  connectToDapp: (options?: { optional?: boolean }) => Promise<void>;
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
