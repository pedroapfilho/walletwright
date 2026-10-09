import type { Page } from "@playwright/test";

import { clicksFor } from "../internal/click";
import { sleep, waitUntil, waitUntilOrThrow } from "../internal/wait";
import type { WalletDefinition } from "../types";

const ROUTE_TIMEOUT_MS = 30_000;
const SEED_PASTE_TIMEOUT_MS = 3000;

const ONBOARDING_ROUTE = "index.html#/new-user/guide";

const { click } = clicksFor("Rabby");

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
  await click(page.getByText("I already have an address", { exact: true }).first());
  await click(page.getByText("Seed Phrase or Private Key", { exact: true }).first());
  await waitForRoute(page, "seed-or-key");

  const words = page.locator('input[type="password"]');
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

  await click(words.first());
  await page.evaluate((phrase) => navigator.clipboard.writeText(phrase), seedPhrase.trim());
  await page.keyboard.press("ControlOrMeta+v");
  const pasted = await waitUntil(lastFilled, { timeoutMs: SEED_PASTE_TIMEOUT_MS });
  if (pasted === undefined) {
    for (let index = 0; index < list.length; index++) {
      const box = words.nth(index);
      await click(box);
      await box.fill(list[index] ?? "");
    }
  }
  await click(page.getByRole("button", { exact: true, name: "Next" }).first());

  await waitForRoute(page, "set-password");
  const passwords = page.locator('input[type="password"]');
  await passwords.nth(1).waitFor({ state: "visible", timeout: 30_000 });
  await passwords.nth(0).fill(password);
  await passwords.nth(1).fill(password);
  await click(page.getByRole("button", { exact: true, name: "Confirm" }).first());

  await page
    .getByText("Address Imported", { exact: false })
    .first()
    .waitFor({ state: "visible", timeout: 30_000 });
  await sleep(1000);
};

export const rabby: WalletDefinition = {
  /**
   * Its window unmounts its contents seconds after losing focus, and reads a click Playwright is still
   * settling as a dismissal, so controls are clicked in-page. Signing is Sign, then Confirm.
   */
  approval: {
    cancel: (popup) => popup.locator("button").filter({ hasText: /^(?:Cancel|Reject)$/v }),
    click: { kind: "inPage" },
    confirm: (popup) => popup.locator("button").filter({ hasText: /^(?:Connect|Sign|Confirm)$/v }),
    headless: true,
  },

  ecosystems: ["evm"],

  extensionName: "Rabby",

  importWallet,

  onboardingPage: ONBOARDING_ROUTE,

  source: { id: "acmacodkjbdgmoleebolmdjonilkdbch", kind: "webStore" },

  unlockScreen: { entry: "index.html" },
};
