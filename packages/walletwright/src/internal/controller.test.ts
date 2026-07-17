import type { BrowserContext, Page } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";

import type { WalletDefinition } from "../types.ts";

import { createWallet } from "./controller.ts";

const stubContext = { pages: () => [] } as unknown as BrowserContext;
const stubHome = {} as unknown as Page;

const makeDefinition = (actions?: WalletDefinition["actions"]): WalletDefinition =>
  ({
    actions,
    approve: vi.fn(),
    extensionName: "Fake Wallet",
  }) as unknown as WalletDefinition;

describe("createWallet", () => {
  it("throws for a capability the definition does not declare", async () => {
    const wallet = createWallet({
      context: stubContext,
      definition: makeDefinition({}),
      extensionId: "fake-extension-id",
      home: stubHome,
      password: "pw",
    });

    await expect(wallet.settings.lock()).rejects.toThrow("does not support settings.lock");
  });

  it("invokes a declared capability's function with the action context", async () => {
    const networkAdd = vi.fn();
    const wallet = createWallet({
      context: stubContext,
      definition: makeDefinition({ network: { add: networkAdd } }),
      extensionId: "fake-extension-id",
      home: stubHome,
      password: "pw",
    });

    const config = { chainId: 1, name: "n", rpcUrl: "http://localhost", symbol: "ETH" };
    await wallet.network.add(config);

    expect(networkAdd).toHaveBeenCalledOnce();
    expect(networkAdd).toHaveBeenCalledWith(
      { context: stubContext, extensionId: "fake-extension-id", home: stubHome, password: "pw" },
      config,
    );
  });

  it("exposes the extensionId and home it was constructed with", () => {
    const wallet = createWallet({
      context: stubContext,
      definition: makeDefinition({}),
      extensionId: "fake-extension-id",
      home: stubHome,
      password: "pw",
    });

    expect(wallet.extensionId).toBe("fake-extension-id");
    expect(wallet.home).toBe(stubHome);
  });
});
