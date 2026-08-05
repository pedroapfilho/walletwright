/**
 * How walletwright launches Chromium with a wallet extension loaded. Shared by the cache build and
 * the test run so the two cannot drift: an extension that loads for onboarding but not for the
 * tests (or the reverse) fails far from its cause.
 */
export const extensionContextOptions = (
  extensionPath: string,
  headless: boolean,
): { args: Array<string>; channel: string; headless: boolean } => ({
  args: [
    `--disable-extensions-except=${extensionPath}`,
    // Required: current Chromium does NOT auto-load the cached unpacked extension without this.
    `--load-extension=${extensionPath}`,
  ],
  // Playwright's default headless build is the headless *shell*, which cannot load an extension at
  // all. The `chromium` channel is the full browser, whose headless mode can. Headed is unaffected:
  // it is the same Chromium build either way.
  channel: "chromium",
  headless,
});
