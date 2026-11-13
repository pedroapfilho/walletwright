import type { BrowserContext, Page } from "@playwright/test";

/** Blockchain ecosystem a wallet operates in. A wallet may span several (e.g. Phantom = EVM + SVM). */
export type Ecosystem = "evm" | "svm" | "sui";

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
  /** 12/24-word seed phrase. Avoid the famous public test seed for Phantom and Slush, they block it. */
  seedPhrase: string;
  /**
   * Pin an extension version. Only wallets downloaded from versioned releases (MetaMask) accept one;
   * the Web Store wallets refuse it rather than silently running whatever build they have.
   */
  version?: string;
  wallet: WalletKind;
};

/** What a supported wallet is, as plain data: nothing in it drives a browser. */
export type WalletInfo = {
  ecosystems: ReadonlyArray<Ecosystem>;
  /**
   * Whether the wallet is verified to run headless, onboarding and approvals both. `buildCache` and
   * `launchWallet` refuse `headless` for the rest, and the fixtures launch them headed.
   */
  headless: boolean;
  /** Display name, as step titles and error messages spell it (`MetaMask`). */
  name: string;
  /** Whether `WalletSetup.version` can pin its extension. A Web Store build cannot be pinned. */
  pinnable: boolean;
};

/** A custom EVM network, as the wallet's add-network form expects it. */
export type NetworkConfig = {
  chainId: number;
  name: string;
  rpcUrl: string;
  symbol: string;
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
 * How a call answers an approval. `optional` waits less and tolerates no window, for a request the
 * wallet may answer by itself (a site it already trusts).
 */
export type ApprovalOptions = { optional?: boolean };

/**
 * Drives an unlocked wallet against a dapp under test. The request-named methods
 * (`connectToDapp`, `confirmSignature`, …) are aliases of `approve`/`reject` that read well in a spec
 * and match Synpress's vocabulary; none of them checks what kind of request the popup holds.
 */
export type Wallet = {
  accounts: AccountsApi;
  /** Approve whatever approval popup is currently pending (connect, sign, tx…). */
  approve: (options?: ApprovalOptions) => Promise<void>;
  confirmSignature: () => Promise<void>;
  confirmTransaction: () => Promise<void>;
  /**
   * Approve a pending connection request popup. Pass `{ optional: true }` for a site the wallet may
   * already trust, where connecting produces no popup at all.
   */
  connectToDapp: (options?: ApprovalOptions) => Promise<void>;
  readonly extensionId: string;
  /**
   * The wallet's own extension page, kept open after unlock. Named `home` rather than `page` because
   * `page` already means the dapp under test in every spec.
   */
  readonly home: Page;
  network: NetworkApi;
  /** Reject whatever approval popup is currently pending (connect, sign, tx…). */
  reject: (options?: ApprovalOptions) => Promise<void>;
  rejectConnection: () => Promise<void>;
  rejectSignature: () => Promise<void>;
  rejectTransaction: () => Promise<void>;
  settings: SettingsApi;
};

/** An unlocked wallet and the browser it runs in, from `launchWallet`. */
export type LaunchedWallet = {
  /** `close()`, so `await using launched = await launchWallet(setup)` cleans up on any exit. */
  [Symbol.asyncDispose]: () => Promise<void>;
  /**
   * Close the browser and remove the throwaway profile copy, in that order. Prefer this over
   * `context.close()`: the copy is a full onboarded profile (tens of MB), and awaiting its removal is
   * the only way to know it is gone before the process exits.
   */
  close: () => Promise<void>;
  context: BrowserContext;
  wallet: Wallet;
};
