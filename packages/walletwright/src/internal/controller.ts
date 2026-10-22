import type { BrowserContext, Page } from "@playwright/test";

import type { Wallet, WalletActionContext, WalletDefinition } from "../types";

import { type Approvals, frontDapp } from "./approval";

/**
 * Runs one named wallet call. The Playwright fixtures report each call as a boxed `test.step`;
 * `launchWallet` has no test to report into, so it runs the call directly.
 */
export type StepRunner = (title: string, body: () => Promise<void>) => Promise<void>;

export const runDirectly: StepRunner = (_title, body) => body();

type CreateWalletOptions = {
  /** Answers the wallet's approval windows. */
  approvals: Approvals;
  context: BrowserContext;
  definition: WalletDefinition;
  extensionId: string;
  /** The wallet's own page, left open after unlock, that the actions drive. */
  home: Page;
  password: string;
  step: StepRunner;
  /** Unlock `home` again through the wallet's unlock screen. */
  unlock: () => Promise<void>;
};

/** Build the runtime controller that drives an unlocked wallet against the dapp under test. */
export const createWallet = ({
  approvals,
  context,
  definition,
  extensionId,
  home,
  password,
  step,
  unlock,
}: CreateWalletOptions): Wallet => {
  const ctx: WalletActionContext = { context, extensionId, home, password, unlock };

  /**
   * Every public call goes through here, so each one reaches `step` under its own name. It awaits
   * `step` itself because Playwright reports a boxed step at the caller of the function awaiting it,
   * which makes that the spec line; another async layer in between would move it into this package.
   */
  const named =
    <Args extends ReadonlyArray<unknown>>(name: string, fn: (...args: Args) => Promise<void>) =>
    async (...args: Args): Promise<void> => {
      await step(`wallet.${name}`, () => fn(...args));
    };

  const { approve, reject } = approvals;

  /** Bind a verified wallet action and restore focus to the dapp when it finishes. */
  const action = <Args extends ReadonlyArray<unknown>>(
    name: string,
    fn: ((ctx: WalletActionContext, ...args: Args) => Promise<void>) | undefined,
  ) =>
    named(name, async (...args: Args): Promise<void> => {
      if (!fn) {
        throw new Error(`[walletwright] ${definition.extensionName} does not support ${name}()`);
      }

      if (home.isClosed()) {
        throw new Error(`[walletwright] wallet home page is closed; cannot run ${name}()`);
      }

      await home.bringToFront().catch(() => {});
      await fn(ctx, ...args);
      await frontDapp(context);
    });

  const { accounts, network, settings } = definition.actions ?? {};

  return {
    accounts: {
      add: action("accounts.add", accounts?.add),
      importPrivateKey: action("accounts.importPrivateKey", accounts?.importPrivateKey),
      rename: action("accounts.rename", accounts?.rename),
      switch: action("accounts.switch", accounts?.switch),
    },
    approve: named("approve", approve),
    confirmSignature: named("confirmSignature", () => approve()),
    confirmTransaction: named("confirmTransaction", () => approve()),
    connectToDapp: named("connectToDapp", approve),
    extensionId,
    home,
    network: {
      add: action("network.add", network?.add),
    },
    reject: named("reject", reject),
    rejectConnection: named("rejectConnection", () => reject()),
    rejectSignature: named("rejectSignature", () => reject()),
    rejectTransaction: named("rejectTransaction", () => reject()),
    settings: {
      lock: action("settings.lock", settings?.lock),
      unlock: action("settings.unlock", settings?.unlock),
    },
  };
};
