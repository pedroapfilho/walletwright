const DEFAULT_INTERVAL_MS = 200;

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
