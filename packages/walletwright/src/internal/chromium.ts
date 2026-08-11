/**
 * How walletwright launches Chromium with a wallet extension loaded. Shared by the cache build and
 * the test run so the two cannot drift: an extension that loads for onboarding but not for the
 * tests (or the reverse) fails far from its cause.
 */
export const extensionContextOptions = (
  extensionPath: string,
  headless: boolean,
): { args: Array<string>; channel: string; headless: boolean } => ({
  args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  channel: "chromium",
  headless,
});
