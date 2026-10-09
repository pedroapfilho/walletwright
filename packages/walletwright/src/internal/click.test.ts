import { errors } from "@playwright/test";
import type { Locator } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";

import { clicksFor } from "./click";

const SELECTOR = "getByTestId('btn-continue')";

const fakeControl = ({
  click = () => Promise.resolve(),
  waitFor = () => Promise.resolve(),
}: {
  click?: () => Promise<void>;
  waitFor?: () => Promise<void>;
} = {}) => {
  const clicked = vi.fn(click);
  const waited = vi.fn(waitFor);
  const control = {
    click: clicked,
    toString: () => SELECTOR,
    waitFor: waited,
  } as unknown as Locator;
  return { clicked, control, waited };
};

const neverShows = () => Promise.reject(new errors.TimeoutError("waitFor: Timeout exceeded"));

const { click, clickIfShown } = clicksFor("Solflare");

describe("click", () => {
  it("waits for the control to show, then clicks it", async () => {
    const { clicked, control, waited } = fakeControl();

    await click(control);

    expect(waited).toHaveBeenCalledWith({ state: "visible", timeout: 30_000 });
    expect(clicked).toHaveBeenCalledWith({ force: false, timeout: 30_000 });
  });

  it("names the wallet, the control, and the budget when the control never shows", async () => {
    const { clicked, control } = fakeControl({ waitFor: neverShows });

    await expect(click(control, { timeoutMs: 60_000 })).rejects.toThrow(
      `[walletwright] Solflare never showed ${SELECTOR} (gave up after 60s)`,
    );
    expect(clicked).not.toHaveBeenCalled();
  });

  it("names the control when it shows but refuses the click", async () => {
    const refusal = new Error("element is not enabled");
    const { control } = fakeControl({ click: () => Promise.reject(refusal) });

    await expect(click(control)).rejects.toMatchObject({
      cause: refusal,
      message: `[walletwright] Solflare showed ${SELECTOR} but it took no click`,
    });
  });

  it("surfaces a failure other than a timeout as itself", async () => {
    const closed = new Error("Target page, context or browser has been closed");
    const { control } = fakeControl({ waitFor: () => Promise.reject(closed) });

    await expect(click(control)).rejects.toBe(closed);
  });

  it("passes force through to the click", async () => {
    const { clicked, control } = fakeControl();

    await click(control, { force: true, timeoutMs: 15_000 });

    expect(clicked).toHaveBeenCalledWith({ force: true, timeout: 15_000 });
  });

  it("settles between the control showing and the click", async () => {
    vi.useFakeTimers();
    try {
      const { clicked, control } = fakeControl();

      const clicking = click(control, { settleMs: 1000 });
      await vi.advanceTimersByTimeAsync(999);
      expect(clicked).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      await clicking;

      expect(clicked).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("clickIfShown", () => {
  it("clicks a control that shows and reports it", async () => {
    const { clicked, control, waited } = fakeControl();

    await expect(clickIfShown(control)).resolves.toBe(true);
    expect(waited).toHaveBeenCalledWith({ state: "visible", timeout: 10_000 });
    expect(clicked).toHaveBeenCalledOnce();
  });

  it("treats a control that never shows as absent", async () => {
    const { clicked, control } = fakeControl({ waitFor: neverShows });

    await expect(clickIfShown(control)).resolves.toBe(false);
    expect(clicked).not.toHaveBeenCalled();
  });

  it("still throws when a control shows and then refuses the click", async () => {
    const { control } = fakeControl({
      click: () => Promise.reject(new Error("element is outside of the viewport")),
    });

    await expect(clickIfShown(control)).rejects.toThrow(
      `[walletwright] Solflare showed ${SELECTOR} but it took no click`,
    );
  });
});
