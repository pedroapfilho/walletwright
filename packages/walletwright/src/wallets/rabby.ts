import type { Page } from "@playwright/test";

import { prepareWebStoreExtension } from "../internal/download";
import { createUnlockScreen } from "../internal/unlock-screen";
import { sleep, waitUntil, waitUntilOrThrow } from "../internal/wait";
import type { WalletDefinition } from "../types";

const ROUTE_TIMEOUT_MS = 30_000;
const SEED_PASTE_TIMEOUT_MS = 3000;
const APPROVAL_TIMEOUT_MS = 30_000;

// Rabby, by DeBank. Pulled from the Chrome Web Store. No manifest `key`, so its id is path-derived.
const RABBY_EXTENSION_ID = "acmacodkjbdgmoleebolmdjonilkdbch";

// Rabby is a single-page app: onboarding, unlock, and the dashboard all live in index.html. A fresh
// profile must enter at the new-user guide; plain index.html lands on a marketing carousel whose
// "Get Started" leads to the add-address menu, which reopens this route in a second tab.
const ONBOARDING_ROUTE = "index.html#/new-user/guide";

const { reachUnlockScreen, unlock } = createUnlockScreen({ entry: "index.html", wallet: "Rabby" });

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
const waitForRoute = async (
  page: Page,
  fragment: string,
  timeoutMs = ROUTE_TIMEOUT_MS,
): Promise<void> => {
  await waitUntilOrThrow(() => page.url().includes(fragment), {
    message: `Rabby never reached ${fragment}`,
    timeoutMs,
  });
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
  const pasted = await waitUntil(lastFilled, { timeoutMs: SEED_PASTE_TIMEOUT_MS });
  // Clipboard access can be denied outright depending on how the profile was launched; typing each
  // box is slower but always works, so fall back rather than submitting a half-filled phrase.
  if (pasted === undefined) {
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
  let lastClicked = "";
  const answered = await waitUntil(
    async () => {
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
      return undefined;
    },
    { intervalMs: 300, timeoutMs: APPROVAL_TIMEOUT_MS },
  );
  return answered === true || popup.isClosed();
};

export const rabby: WalletDefinition = {
  approve: async (popup) => {
    if (!(await clickApprovalButton(popup, CONFIRM_LABELS))) {
      throw new Error("[walletwright] Rabby approval: no confirm button became actionable");
    }
  },

  ecosystems: ["evm"],

  extensionName: "Rabby",

  // Its approval window surfaces as a page headless, verified end to end on Linux CI and macOS.
  headlessApprovals: true,

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
