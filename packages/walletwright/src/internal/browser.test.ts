import type { BrowserContext } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";

import type { WalletDefinition } from "../types";

import { openWalletContext } from "./browser";

describe("openWalletContext", () => {
  it("closes the browser it launched when the wallet's prepareContext fails", async () => {
    const close = vi.fn(() => Promise.resolve());
    const context = { close } as unknown as BrowserContext;
    const definition = {
      prepareContext: () => Promise.reject(new Error("route failed")),
    } as unknown as WalletDefinition;

    await expect(
      openWalletContext({
        definition,
        extensionPath: "/tmp/walletwright-no-extension",
        headless: true,
        launchPersistentContext: () => Promise.resolve(context),
        userDataDir: "/tmp/walletwright-no-profile",
      }),
    ).rejects.toThrow("route failed");
    expect(close).toHaveBeenCalledOnce();
  });

  it("launches the full chromium channel with only the wallet's extension loaded", async () => {
    const launch = vi.fn(() => Promise.resolve({} as BrowserContext));

    await openWalletContext({
      definition: {} as WalletDefinition,
      extensionPath: "/ext",
      headless: true,
      launchPersistentContext: launch,
      userDataDir: "/profile",
    });

    expect(launch).toHaveBeenCalledWith("/profile", {
      args: ["--disable-extensions-except=/ext", "--load-extension=/ext"],
      channel: "chromium",
      headless: true,
    });
  });
});
