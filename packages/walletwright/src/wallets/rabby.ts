import type { Page } from "@playwright/test";

import { prepareWebStoreExtension } from "../internal/download";
import { createUnlockScreen } from "../internal/unlock-screen";
import { sleep, waitUntil, waitUntilOrThrow } from "../internal/wait";
import type { WalletDefinition } from "../types";

const ROUTE_TIMEOUT_MS = 30_000;
const SEED_PASTE_TIMEOUT_MS = 3000;
const APPROVAL_TIMEOUT_MS = 30_000;

const RABBY_EXTENSION_ID = "acmacodkjbdgmoleebolmdjonilkdbch";

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
  if (pasted === undefined) {
    for (let index = 0; index < list.length; index++) {
      const box = words.nth(index);
      await box.click();
      await box.fill(list[index] ?? "");
    }
  }
  await page.getByRole("button", { exact: true, name: "Next" }).first().click();

  await waitForRoute(page, "set-password");
  const passwords = page.locator('input[type="password"]');
  await passwords.nth(1).waitFor({ state: "visible", timeout: 30_000 });
  await passwords.nth(0).fill(password);
  await passwords.nth(1).fill(password);
  await page.getByRole("button", { exact: true, name: "Confirm" }).first().click();

  await page
    .getByText("Address Imported", { exact: false })
    .first()
    .waitFor({ state: "visible", timeout: 30_000 });
  await sleep(1000);
};

const CONFIRM_LABELS = ["Connect", "Sign", "Confirm"];
const CANCEL_LABELS = ["Cancel", "Reject"];

/** Rabby's focus-fragile popup requires in-page clicks; signing then requires a second Confirm click. */
const clickApprovalButton = async (
  popup: Page,
  labels: ReadonlyArray<string>,
): Promise<boolean> => {
  // Every label already clicked, not just the most recent one: after Sign then Confirm, a one-slot
  // memory makes "Sign" eligible again, and re-clicking it re-issues the request.
  const clickedLabels = new Set<string>();
  const answered = await waitUntil(
    async () => {
      if (popup.isClosed()) {
        return true;
      }
      const clicked = await popup
        .evaluate(
          (arg) => {
            const target = [...document.querySelectorAll("button")].find((button) => {
              const text = (button.textContent ?? "").trim();
              return arg.names.includes(text) && !button.disabled && !arg.skip.includes(text);
            });
            target?.click();
            return target ? (target.textContent ?? "").trim() : "";
          },
          { names: [...labels], skip: [...clickedLabels] },
        )
        .catch(() => "");
      if (clicked) {
        clickedLabels.add(clicked);
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

  headlessApprovals: true,

  importWallet,

  onboardingPage: ONBOARDING_ROUTE,

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
