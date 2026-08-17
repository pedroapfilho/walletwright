import type { BrowserContext, Page } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";

import type { WalletDefinition } from "../types";

import { createWallet } from "./controller";

const stubContext = { pages: () => [] } as unknown as BrowserContext;
const stubHome = {
  bringToFront: () => Promise.resolve(),
  isClosed: () => false,
} as unknown as Page;

const makeDefinition = (actions?: WalletDefinition["actions"]): WalletDefinition =>
  ({
    actions,
    approve: vi.fn(),
    extensionName: "Fake Wallet",
  }) as unknown as WalletDefinition;

const makeWallet = (actions?: WalletDefinition["actions"], home: Page = stubHome) =>
  createWallet({
    context: stubContext,
    definition: makeDefinition(actions),
    extensionId: "fake-extension-id",
    home,
    password: "pw",
  });

type ActionGroup = keyof NonNullable<WalletDefinition["actions"]>;

/**
 * Every capability group, kept exhaustive by the compiler: a group added to `WalletActions` fails to
 * typecheck here until it is listed, and the two wiring tests below then cover its methods without
 * being edited. Method names are never written down, they are read off the constructed wallet.
 */
const GROUP_MARKERS: Record<ActionGroup, true> = { accounts: true, network: true, settings: true };
const GROUPS = Object.keys(GROUP_MARKERS) as Array<ActionGroup>;

type AnyAction = (...args: Array<unknown>) => Promise<void>;

const methodsOf = (wallet: ReturnType<typeof makeWallet>, group: ActionGroup) =>
  wallet[group] as unknown as Record<string, AnyAction>;

/**
 * Stubs any method the controller reaches and records the `group.method` path it was reached through,
 * so a swapped pair (`rename` wired to `switch` and back) shows up as two wrong paths rather than as
 * two spies that were each called once.
 */
const recordingActions = (calls: Array<string>): WalletDefinition["actions"] =>
  Object.fromEntries(
    GROUPS.map((group) => [
      group,
      new Proxy(
        {},
        {
          get: (_target, method: string | symbol) =>
            typeof method === "string"
              ? () => {
                  calls.push(`${group}.${method}`);
                  return Promise.resolve();
                }
              : undefined,
        },
      ),
    ]),
  );

describe("createWallet", () => {
  it("throws for a capability the definition does not declare", async () => {
    const wallet = makeWallet({});

    await expect(wallet.settings.lock()).rejects.toThrow("does not support settings.lock");
  });

  it("invokes a declared capability's function with the action context", async () => {
    const networkAdd = vi.fn();
    const wallet = makeWallet({ network: { add: networkAdd } });

    const config = { chainId: 1, name: "n", rpcUrl: "http://localhost", symbol: "ETH" };
    await wallet.network.add(config);

    expect(networkAdd).toHaveBeenCalledOnce();
    expect(networkAdd).toHaveBeenCalledWith(
      { context: stubContext, extensionId: "fake-extension-id", home: stubHome, password: "pw" },
      config,
    );
  });

  it("dispatches each capability method to the definition function at the same path", async () => {
    const calls: Array<string> = [];
    const wallet = makeWallet(recordingActions(calls));

    for (const group of GROUPS) {
      const methods = methodsOf(wallet, group);
      expect(Object.keys(methods).length).toBeGreaterThan(0);

      for (const method of Object.keys(methods)) {
        calls.length = 0;
        await methods[method]();
        expect(calls).toEqual([`${group}.${method}`]);
      }
    }
  });

  it("names its own path when an undeclared capability is called", async () => {
    const wallet = makeWallet({});

    for (const group of GROUPS) {
      const methods = methodsOf(wallet, group);
      expect(Object.keys(methods).length).toBeGreaterThan(0);

      for (const method of Object.keys(methods)) {
        await expect(methods[method]()).rejects.toThrow(`does not support ${group}.${method}()`);
      }
    }
  });

  it("fails fast when the wallet home page is closed, without invoking the action", async () => {
    const settingsLock = vi.fn();
    const wallet = makeWallet({ settings: { lock: settingsLock } }, {
      isClosed: () => true,
    } as unknown as Page);

    await expect(wallet.settings.lock()).rejects.toThrow("home page is closed");
    expect(settingsLock).not.toHaveBeenCalled();
  });

  it("exposes the extensionId and home it was constructed with", () => {
    const wallet = makeWallet({});

    expect(wallet.extensionId).toBe("fake-extension-id");
    expect(wallet.home).toBe(stubHome);
  });
});
