import type { BrowserContext, Page } from "@playwright/test";

import { prepareWebStoreExtension } from "../internal/download.ts";
import { sleep } from "../internal/utils.ts";
import type { WalletDefinition } from "../types.ts";

// Slush (formerly Sui Wallet), by Mysten Labs. Pulled from the Chrome Web Store.
const SLUSH_EXTENSION_ID = "opcgpfmipidbgpenhmajoajpbobppdil";

// Slush is a single-page app: popup, onboarding, unlock, and approvals all live in index.html.
const HOME_ROUTE = "#/tokens";

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
    if (await input.isVisible({ timeout: 4000 }).catch(() => false)) {
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

    // "OnboardingSecurity" info screen → Next → "CreateWallet" spinner → home.
    await page
      .getByRole("button", { name: "Next" })
      .click()
      .catch(() => {});
    for (let i = 0; i < 30; i++) {
      const route = await page.evaluate(() => globalThis.location.hash).catch(() => "");
      if (route === HOME_ROUTE) {
        break;
      }
      await sleep(1000);
    }
  },

  // Approvals open as index.html popups marked with `isPopup=1` (no separate notification.html).
  notificationMatch: "isPopup=1",

  onboardingPage: "index.html",

  // Latest from the Web Store, so `version` is ignored.
  prepareExtension: (cacheDir) =>
    prepareWebStoreExtension({
      cacheDir,
      extensionId: SLUSH_EXTENSION_ID,
      name: "slush-chrome-latest",
    }),

  reachUnlockScreen: async (context: BrowserContext, extensionId) => {
    const page = await context.newPage();
    const url = `chrome-extension://${extensionId}/index.html`;
    for (let attempt = 0; attempt < 15; attempt++) {
      const ok = await page
        .goto(url, { waitUntil: "domcontentloaded" })
        .then(() => true)
        .catch(() => false);
      if (ok) {
        break;
      }
      await sleep(1000);
    }
    // Slush's single-page UI mounts a few seconds after the navigation resolves and settles into one
    // of two states: the password screen (cold launch, locked) or the home route (warm launch,
    // already unlocked). Poll for whichever appears instead of blind-sleeping and returning a
    // not-yet-ready page whose failure would only surface later at the first approval.
    const password = page.locator('input[type="password"]');
    for (let attempt = 0; attempt < 30; attempt++) {
      const atHome =
        (await page.evaluate(() => globalThis.location.hash).catch(() => "")) === HOME_ROUTE;
      const locked = await password.isVisible().catch(() => false);
      if (atHome || locked) {
        return page;
      }
      await sleep(500);
    }
    throw new Error("[walletwright] Slush unlock screen never appeared");
  },

  // Both the connect and sign popups cancel via a text "Reject" button. Like approve, the popup
  // reports the button visible before its React handlers wire up, so settle first or the click
  // no-ops silently.
  reject: async (popup) => {
    await sleep(2000);
    if (!(await fclick(popup, "Reject"))) {
      throw new Error("[walletwright] Slush reject: no Reject control was actionable");
    }
  },

  unlock: async (page, password) => {
    // Slush typically reopens unlocked; only fill if it shows the password screen.
    const input = page.locator('input[type="password"]');
    if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
      await input.fill(password);
      await fclick(page, "Unlock");
      await sleep(1500);
    }
  },
};
