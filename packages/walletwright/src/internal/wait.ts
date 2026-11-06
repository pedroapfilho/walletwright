import type { Page } from "@playwright/test";

const DEFAULT_INTERVAL_MS = 200;
const NAVIGATION_INTERVAL_MS = 1000;
const NAVIGATION_TIMEOUT_MS = 15_000;

type WaitOptions = {
  /** Gap between checks. */
  intervalMs?: number;
  /** Total budget. `check` runs at least once, and never again once the budget has elapsed. */
  timeoutMs: number;
};

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** Render a timeout for an error message, so what a failure claims matches what it waited. */
export const formatTimeout = (ms: number): string => `${Math.round(ms / 100) / 10}s`;

/** Poll until `check` returns a value, or `undefined` when the timeout expires. */
export const waitUntil = async <T>(
  check: () => Promise<T | false | undefined> | T | false | undefined,
  { intervalMs = DEFAULT_INTERVAL_MS, timeoutMs }: WaitOptions,
): Promise<T | undefined> => {
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const result = await check();

    if (result !== undefined && result !== false) {
      return result;
    }

    if (Date.now() >= deadline) {
      return undefined;
    }

    await sleep(intervalMs);
  }
};

export const waitUntilOrThrow = async <T>(
  check: () => Promise<T | false | undefined> | T | false | undefined,
  options: WaitOptions & { message: string },
): Promise<T> => {
  const result = await waitUntil(check, options);

  if (result === undefined) {
    throw new Error(
      `[walletwright] ${options.message} (gave up after ${formatTimeout(options.timeoutMs)})`,
    );
  }

  return result;
};

/**
 * Open one of the extension's own pages. A `chrome-extension://` URL fails with
 * `ERR_BLOCKED_BY_CLIENT` until the extension registers, which takes seconds after launch, so
 * reaching one is a poll rather than a one-shot.
 */
export const gotoExtensionPage = async (
  page: Page,
  { extensionId, path, wallet }: { extensionId: string; path: string; wallet: string },
): Promise<void> => {
  const url = `chrome-extension://${extensionId}/${path}`;

  await waitUntilOrThrow(
    () =>
      page
        .goto(url, { waitUntil: "domcontentloaded" })
        .then(() => true)
        .catch(() => undefined),
    {
      intervalMs: NAVIGATION_INTERVAL_MS,
      message: `${wallet} ${path} never loaded (${url})`,
      timeoutMs: NAVIGATION_TIMEOUT_MS,
    },
  );
};
