import type { BrowserContext, Page } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";

import type { WalletDefinition } from "../types.ts";

import { createWallet } from "./controller.ts";

describe("capability wiring", () => {
  it("dispatches every declared capability method to its definition function", async () => {
    const spies = {
      accountsAdd: vi.fn(),
      accountsImport: vi.fn(),
      accountsRename: vi.fn(),
      accountsSwitch: vi.fn(),
      networkAdd: vi.fn(),
      networkSwitch: vi.fn(),
      settingsLock: vi.fn(),
      settingsUnlock: vi.fn(),
    };
    const definition = {
      actions: {
        accounts: {
          add: spies.accountsAdd,
          importPrivateKey: spies.accountsImport,
          rename: spies.accountsRename,
          switch: spies.accountsSwitch,
        },
        network: { add: spies.networkAdd, switch: spies.networkSwitch },
        settings: { lock: spies.settingsLock, unlock: spies.settingsUnlock },
      },
      extensionName: "Fake",
    } as unknown as WalletDefinition;

    const wallet = createWallet({
      context: { pages: () => [] } as unknown as BrowserContext,
      definition,
      extensionId: "fake",
      home: { bringToFront: () => Promise.resolve(), isClosed: () => false } as unknown as Page,
      password: "pw",
    });

    await wallet.accounts.add();
    await wallet.accounts.importPrivateKey("0xkey");
    await wallet.accounts.rename({ index: 0, name: "x" });
    await wallet.accounts.switch(0);
    await wallet.network.add({ chainId: 1, name: "n", rpcUrl: "u", symbol: "s" });
    await wallet.network.switch(1);
    await wallet.settings.lock();
    await wallet.settings.unlock();

    expect(spies.accountsAdd).toHaveBeenCalledOnce();
    expect(spies.accountsImport).toHaveBeenCalledOnce();
    expect(spies.accountsRename).toHaveBeenCalledOnce();
    expect(spies.accountsSwitch).toHaveBeenCalledOnce();
    expect(spies.networkAdd).toHaveBeenCalledOnce();
    expect(spies.networkSwitch).toHaveBeenCalledOnce();
    expect(spies.settingsLock).toHaveBeenCalledOnce();
    expect(spies.settingsUnlock).toHaveBeenCalledOnce();
  });
});
