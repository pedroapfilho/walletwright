import type { Page } from "@playwright/test";

import { prepareWebStoreExtension } from "../internal/download";
import { createUnlockScreen } from "../internal/unlock-screen";
import { sleep, waitUntilOrThrow } from "../internal/wait";
import type { WalletDefinition } from "../types";

// Slush (formerly Sui Wallet), by Mysten Labs. Pulled from the Chrome Web Store.
const SLUSH_EXTENSION_ID = "opcgpfmipidbgpenhmajoajpbobppdil";

// Slush is a single-page app: popup, onboarding, unlock, and approvals all live in index.html.
const HOME_ROUTE = "#/tokens";

const IMPORT_HOME_TIMEOUT_MS = 30_000;

const atHome = async (page: Page): Promise<boolean> =>
  (await page.evaluate(() => globalThis.location.hash).catch(() => "")) === HOME_ROUTE;

const fclick = async (page: Page, text: string, timeoutMs = 15_000): Promise<boolean> => {
  const target = page.getByText(text, { exact: true }).first();
  // isVisible() reports the *current* state without waiting; Slush's single-page UI mounts its React
  // tree a few seconds after domcontentloaded, so an instant check reads false and the click is
  // silently skipped. waitFor blocks until the element is actually visible (or the budget elapses).
  const visible = await target
    .waitFor({ state: "visible", timeout: timeoutMs })
    .then(() => true)
    .catch(() => false);
  if (!visible) {
    return false;
  }
  await target.scrollIntoViewIfNeeded().catch(() => {});
  // Slush's popup buttons need a forced click; do NOT swallow a real click failure here.
  await target.click({ force: true, timeout: timeoutMs });
  return true;
};

const { reachUnlockScreen, unlock } = createUnlockScreen({
  entry: "index.html",
  // Slush's single-page UI mounts a few seconds after the navigation resolves and settles into one
  // of two states: the password screen (cold launch, locked) or the home route (warm launch, already
  // unlocked). Anything else is a page that never mounted, and driving it would only fail later, at
  // the first approval.
  isUnlocked: atHome,
  submit: async (page) => {
    await fclick(page, "Unlock");
  },
  wallet: "Slush",
});

export const slush: WalletDefinition = {
  // Connect confirms with "Approve"; signing confirms with "Sign" and then re-prompts for the
  // password ("Unlock") before it completes.
  approve: async (popup, password) => {
    // Slush's popup reports the button visible before its React handlers are wired, a click that
    // lands too early is a silent no-op. Let it settle first.
    await sleep(2000);
    // Probe Approve with a short budget so a signing popup (no Approve button) falls through to
    // Sign quickly instead of waiting out fclick's full budget on an element that never appears.
    const confirmed = (await fclick(popup, "Approve", 4000)) || (await fclick(popup, "Sign"));
    if (!confirmed) {
      throw new Error("[walletwright] Slush approval: neither Approve nor Sign was actionable");
    }
    await sleep(1500);
    const input = popup.locator('input[type="password"]');
    if (await input.isVisible().catch(() => false)) {
      await input.fill(password);
      await fclick(popup, "Unlock");
    }
  },

  ecosystems: ["sui"],

  extensionName: "Slush",

  importWallet: async (page, seedPhrase, password) => {
    await fclick(page, "More options");
    await sleep(1000);
    await fclick(page, "Import existing from passphrase");
    await sleep(1500);

    const words = seedPhrase.trim().split(/\s+/v);
    for (let i = 0; i < words.length; i++) {
      await page.locator(`input[placeholder="Word ${i + 1}"]`).fill(words[i] ?? "");
    }
    await page.getByRole("button", { name: "Next" }).click();
    await sleep(2000);

    await page.locator('input[placeholder="Password"]').fill(password);
    await page.locator('input[placeholder="Confirm Password"]').fill(password);
    await page.getByRole("button", { name: "Next" }).click();
    await sleep(2000);

    // "OnboardingSecurity" info screen → Next → "CreateWallet" spinner → home. The spinner must
    // finish or the wallet never persists, so reaching home is the only proof the import took.
    await page
      .getByRole("button", { name: "Next" })
      .click()
      .catch(() => {});
    await waitUntilOrThrow(() => atHome(page), {
      intervalMs: 1000,
      message: `Slush import never reached the wallet home (${HOME_ROUTE})`,
      timeoutMs: IMPORT_HOME_TIMEOUT_MS,
    });
  },

  // Approvals open as index.html popups marked with `isPopup=1` (no separate notification.html).
  notificationMatch: "isPopup=1",

  onboardingPage: "index.html",

  // Slush's own backend (api.slush.app, initialize.slush.app) answers every request from an
  // automated browser with a Cloudflare 403 whose body is the Mysten Labs marketing page. Slush's
  // GraphQL client throws `NonGraphQLResponseError` on that HTML and renders a "Reload App" error
  // screen instead of the wallet, so onboarding never reaches its first screen. A well-formed empty
  // response is all it needs to boot; onboarding, unlock, connect, and sign need nothing from the
  // API. Drop this once the endpoint answers automated requests again.
  prepareContext: async (context) => {
    await context.route("**://*.slush.app/**", (route) =>
      route.fulfill({
        body: JSON.stringify({ data: {} }),
        contentType: "application/json",
        status: 200,
      }),
    );
  },

  // Latest from the Web Store, so `version` is ignored.
  prepareExtension: (cacheDir) =>
    prepareWebStoreExtension({
      cacheDir,
      extensionId: SLUSH_EXTENSION_ID,
      name: "slush-chrome-latest",
    }),

  reachUnlockScreen,

  // Both the connect and sign popups cancel via a text "Reject" button. Like approve, the popup
  // reports the button visible before its React handlers wire up, so settle first or the click
  // no-ops silently.
  reject: async (popup) => {
    await sleep(2000);
    if (!(await fclick(popup, "Reject"))) {
      throw new Error("[walletwright] Slush reject: no Reject control was actionable");
    }
  },

  unlock,
};
