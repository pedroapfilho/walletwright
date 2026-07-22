import type { BrowserContext, Page } from "@playwright/test";

import { prepareWebStoreExtension } from "../internal/download.ts";
import { sleep } from "../internal/utils.ts";
import type { WalletDefinition } from "../types.ts";

// Rabby, by DeBank. Pulled from the Chrome Web Store. No manifest `key`, so its id is path-derived.
const RABBY_EXTENSION_ID = "acmacodkjbdgmoleebolmdjonilkdbch";

// Rabby is a single-page app: onboarding, unlock, and the dashboard all live in index.html. A fresh
// profile must enter at the new-user guide; plain index.html lands on a marketing carousel whose
// "Get Started" leads to the add-address menu, which reopens this route in a second tab.
const ONBOARDING_ROUTE = "index.html#/new-user/guide";

const clickText = async (page: Page, text: string, timeoutMs = 30_000): Promise<void> => {
  const target = page.getByText(text, { exact: true }).first();
  await target.waitFor({ state: "visible", timeout: timeoutMs });
  await target.click();
};

/**
 * Rabby routes with a hash router, so `waitForURL` never settles (a hash change fires no navigation
 * event). Poll the URL instead. Anchoring each onboarding step on its route matters because several
 * screens share the same `input[type="password"]` selector.
 */
const waitForRoute = async (page: Page, fragment: string, timeoutMs = 30_000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (page.url().includes(fragment)) {
      return;
    }
    await sleep(200);
  }
  throw new Error(`[walletwright] Rabby never reached ${fragment}`);
};

const importWallet = async (page: Page, seedPhrase: string, password: string): Promise<void> => {
  await clickText(page, "I already have an address");
  await clickText(page, "Seed Phrase or Private Key");
  await waitForRoute(page, "seed-or-key");

  // The 12 word boxes are unlabelled `type=password` inputs that re-render as they fill, so filling
  // them one by one drops words. Pasting the whole phrase into the first box is the path Rabby
  // supports: it splits on whitespace and distributes across every box at once.
  const words = page.locator('input[type="password"]');
  await words.first().waitFor({ state: "visible", timeout: 30_000 });
  await page
    .context()
    .grantPermissions(["clipboard-read", "clipboard-write"])
    .catch(() => {});
  const list = seedPhrase.trim().split(/\s+/v);
  const lastFilled = async (): Promise<boolean> => {
    const value = await words
      .nth(list.length - 1)
      .inputValue()
      .catch(() => "");
    return value.trim().length > 0;
  };

  await words.first().click();
  await page.evaluate((phrase) => navigator.clipboard.writeText(phrase), seedPhrase.trim());
  await page.keyboard.press("ControlOrMeta+v");
  for (let attempt = 0; attempt < 15 && !(await lastFilled()); attempt++) {
    await sleep(200);
  }
  // Clipboard access can be denied outright depending on how the profile was launched; typing each
  // box is slower but always works, so fall back rather than submitting a half-filled phrase.
  if (!(await lastFilled())) {
    for (let index = 0; index < list.length; index++) {
      const box = words.nth(index);
      await box.click();
      await box.fill(list[index] ?? "");
    }
  }
  await page.getByRole("button", { exact: true, name: "Next" }).first().click();

  // "Set Password" screen: the new password and its confirmation, then Confirm. Wait for the route,
  // not just for two password inputs: the seed screen still shows twelve of them, so a bare
  // `nth(1)` would match word 2 and overwrite the phrase.
  await waitForRoute(page, "set-password");
  const passwords = page.locator('input[type="password"]');
  await passwords.nth(1).waitFor({ state: "visible", timeout: 30_000 });
  await passwords.nth(0).fill(password);
  await passwords.nth(1).fill(password);
  await page.getByRole("button", { exact: true, name: "Confirm" }).first().click();

  // The success screen is where the keyring is persisted; "Open Wallet" only navigates to the
  // dashboard, so the cache is complete without it.
  await page
    .getByText("Address Imported", { exact: false })
    .first()
    .waitFor({ state: "visible", timeout: 30_000 });
  await sleep(1000);
};

const reachUnlockScreen = async (context: BrowserContext, extensionId: string): Promise<Page> => {
  const page = await context.newPage();
  const password = page.locator('input[type="password"]');
  await page.goto(`chrome-extension://${extensionId}/index.html`).catch(() => {});
  // Like MetaMask, the MV3 worker needs a few seconds to restore the vault; reload rather than
  // re-goto, which would reset the page before the worker answers.
  let ready = await password
    .waitFor({ state: "visible", timeout: 20_000 })
    .then(() => true)
    .catch(() => false);
  for (let attempt = 0; attempt < 5 && !ready; attempt++) {
    await page.reload().catch(() => {});
    ready = await password
      .waitFor({ state: "visible", timeout: 5000 })
      .then(() => true)
      .catch(() => false);
  }
  if (!ready) {
    throw new Error("[walletwright] Rabby unlock screen never appeared");
  }
  return page;
};

const unlock = async (page: Page, password: string): Promise<void> => {
  const input = page.locator('input[type="password"]');
  await input.fill(password);
  await input.press("Enter");
  const cleared = await page
    .locator('input[type="password"]')
    .waitFor({ state: "hidden", timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  if (!cleared) {
    throw new Error("[walletwright] Rabby unlock failed (password screen still visible after 15s)");
  }
};

const CONFIRM_LABELS = ["Connect", "Sign", "Confirm"];
const CANCEL_LABELS = ["Cancel", "Reject"];

/**
 * Rabby's approval window is focus-fragile: it unmounts its contents a few seconds after losing
 * focus, and Playwright's click (which waits for actionability, then for the click to settle) loses
 * the window mid-action. Rabby reads the vanished window as a dismissal, so the dapp gets
 * "User rejected the request" even though the confirm button was visible and enabled. Dispatching
 * the click inside the page skips focus, actionability, and post-click bookkeeping entirely. Rabby
 * is a plain React app, so `evaluate` works here (unlike MetaMask, which scuttles the realm).
 *
 * Signing is a two-step footer: "Sign" swaps itself for "Confirm", which must be clicked too, and
 * both start disabled while Rabby analyses the request. So keep clicking whichever labelled button
 * is currently enabled until the window closes, which is the only signal the request was answered.
 */
const clickApprovalButton = async (
  popup: Page,
  labels: ReadonlyArray<string>,
): Promise<boolean> => {
  const deadline = Date.now() + 30_000;
  let lastClicked = "";
  while (Date.now() < deadline) {
    // The popup closing is the only real signal the request was answered.
    if (popup.isClosed()) {
      return true;
    }
    // Click each distinct label once: re-clicking a still-open "Connect" re-issues the request and
    // the dapp ends up with nothing, while "Sign" legitimately needs a follow-up "Confirm".
    const clicked = await popup
      .evaluate(
        (arg) => {
          const target = [...document.querySelectorAll("button")].find((button) => {
            const text = (button.textContent ?? "").trim();
            return arg.names.includes(text) && !button.disabled && text !== arg.skip;
          });
          target?.click();
          return target ? (target.textContent ?? "").trim() : "";
        },
        { names: [...labels], skip: lastClicked },
      )
      .catch(() => "");
    if (clicked) {
      lastClicked = clicked;
    }
    await sleep(300);
  }
  return popup.isClosed();
};

export const rabby: WalletDefinition = {
  approve: async (popup) => {
    if (!(await clickApprovalButton(popup, CONFIRM_LABELS))) {
      throw new Error("[walletwright] Rabby approval: no confirm button became actionable");
    }
  },

  ecosystems: ["evm"],

  extensionName: "Rabby",

  importWallet,

  onboardingPage: ONBOARDING_ROUTE,

  // Latest from the Web Store, so `version` is ignored.
  prepareExtension: (cacheDir) =>
    prepareWebStoreExtension({
      cacheDir,
      extensionId: RABBY_EXTENSION_ID,
      name: "rabby-chrome-latest",
    }),

  reachUnlockScreen,

  reject: async (popup) => {
    if (!(await clickApprovalButton(popup, CANCEL_LABELS))) {
      throw new Error("[walletwright] Rabby reject: no cancel button became actionable");
    }
  },

  unlock,
};
