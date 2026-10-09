import type { Page } from "@playwright/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { staleConnectPage } from "./approve";

const popupAt = (hash: string, enabled: boolean) => {
  const reload = vi.fn(() => Promise.resolve(null));
  const popup = {
    getByTestId: () => ({
      isEnabled: () => Promise.resolve(enabled),
      isVisible: () => Promise.resolve(true),
    }),
    reload,
    url: () => `chrome-extension://id/notification.html${hash}`,
  } as unknown as Page;
  return { popup, reload };
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("staleConnectPage", () => {
  it("reloads a connect page whose Connect stays disabled", async () => {
    const { popup, reload } = popupAt("#/connect/abc", false);

    expect(await staleConnectPage.shows(popup)).toBe(true);
    const passed = staleConnectPage.pass(popup);
    await vi.advanceTimersByTimeAsync(4000);
    await passed;

    expect(reload).toHaveBeenCalledOnce();
  });

  it("does not show once Connect is enabled", async () => {
    const { popup } = popupAt("#/connect/abc", true);

    expect(await staleConnectPage.shows(popup)).toBe(false);
  });

  it("leaves a connect page alone when Connect enables within the grace period", async () => {
    const { popup, reload } = popupAt("#/connect/abc", true);

    await staleConnectPage.pass(popup);

    expect(reload).not.toHaveBeenCalled();
  });

  it("never shows on a signature or transaction page, where a disabled confirm is still working", async () => {
    const { popup } = popupAt("#/confirm-transaction/abc", false);

    expect(await staleConnectPage.shows(popup)).toBe(false);
  });
});
