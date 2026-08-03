import { describe, expect, it, vi } from "vitest";

import { formatTimeout, waitUntil, waitUntilOrThrow } from "./wait";

describe("waitUntil", () => {
  it("returns the first truthy value the check yields", async () => {
    const check = vi
      .fn<() => undefined | string>()
      .mockReturnValueOnce(undefined)
      .mockReturnValue("ready");

    await expect(waitUntil(check, { intervalMs: 1, timeoutMs: 1000 })).resolves.toBe("ready");
    expect(check).toHaveBeenCalledTimes(2);
  });

  it("treats false like undefined, so a boolean check keeps polling", async () => {
    const check = vi.fn<() => boolean>().mockReturnValueOnce(false).mockReturnValue(true);

    await expect(waitUntil(check, { intervalMs: 1, timeoutMs: 1000 })).resolves.toBe(true);
    expect(check).toHaveBeenCalledTimes(2);
  });

  it("runs the check once even with no budget left", async () => {
    const check = vi.fn<() => boolean>().mockReturnValue(false);

    await expect(waitUntil(check, { timeoutMs: 0 })).resolves.toBeUndefined();
    expect(check).toHaveBeenCalledOnce();
  });

  it("stops polling once the budget elapses", async () => {
    const started = Date.now();

    await expect(
      waitUntil(() => false, { intervalMs: 10, timeoutMs: 50 }),
    ).resolves.toBeUndefined();
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

describe("waitUntilOrThrow", () => {
  it("reports the budget it actually waited", async () => {
    await expect(
      waitUntilOrThrow(() => false, {
        intervalMs: 1,
        message: "wallet never woke up",
        timeoutMs: 200,
      }),
    ).rejects.toThrow("[walletwright] wallet never woke up (gave up after 0.2s)");
  });

  it("passes the value through when the check succeeds", async () => {
    await expect(
      waitUntilOrThrow(() => "page", { message: "unused", timeoutMs: 20 }),
    ).resolves.toBe("page");
  });
});

describe("formatTimeout", () => {
  it("renders a timeout in seconds", () => {
    expect(formatTimeout(15_000)).toBe("15s");
    expect(formatTimeout(45_000)).toBe("45s");
    expect(formatTimeout(500)).toBe("0.5s");
  });
});
