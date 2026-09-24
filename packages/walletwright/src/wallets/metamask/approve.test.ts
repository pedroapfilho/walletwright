import type { Page } from "@playwright/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { reloadStaleConnectPage } from "./approve";

const popupAt = (hash: string, enabled: boolean) => {
  const reload = vi.fn(() => Promise.resolve(null));
  const popup = {
    getByTestId: () => ({ isEnabled: () => Promise.resolve(enabled) }),
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

describe("reloadStaleConnectPage", () => {
  it("reloads a connect page whose Connect stays disabled", async () => {
    const { popup, reload } = popupAt("#/connect/abc", false);

    const settled = reloadStaleConnectPage(popup);
    await vi.advanceTimersByTimeAsync(4000);
    await settled;

    expect(reload).toHaveBeenCalledOnce();
  });

  it("leaves a connect page alone once Connect is enabled", async () => {
    const { popup, reload } = popupAt("#/connect/abc", true);

    await reloadStaleConnectPage(popup);

    expect(reload).not.toHaveBeenCalled();
  });

  it("never reloads a signature or transaction page, where a disabled confirm is still working", async () => {
    const { popup, reload } = popupAt("#/confirm-transaction/abc", false);

    await reloadStaleConnectPage(popup);

    expect(reload).not.toHaveBeenCalled();
  });
});
