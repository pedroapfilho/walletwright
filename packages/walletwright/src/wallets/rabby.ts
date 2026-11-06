import type { Page } from "@playwright/test";

import { clicksFor } from "../internal/click";
import { waitUntil, waitUntilOrThrow } from "../internal/wait";
import type { WalletDefinition } from "../types";

const ROUTE_TIMEOUT_MS = 30_000;
const SEED_PASTE_TIMEOUT_MS = 3000;

const ONBOARDING_ROUTE = "index.html#/new-user/guide";

const RABBY = "Rabby";

const { click, waitShown } = clicksFor(RABBY);

/**
 * Rabby routes with a hash router, so `waitForURL` never settles (a hash change fires no navigation
 * event). Poll the URL instead. Anchoring each onboarding step on its route matters because several
 * screens share the same `input[type="password"]` selector.
 */
const waitForRoute = async (page: Page, fragment: string): Promise<void> => {
  await waitUntilOrThrow(() => page.url().includes(fragment), {
    message: `${RABBY} never reached ${fragment}`,
    timeoutMs: ROUTE_TIMEOUT_MS,
  });
};

const importWallet = async (
  page: Page,
  seedWords: ReadonlyArray<string>,
  password: string,
): Promise<void> => {
  await click(page.getByText("I already have an address", { exact: true }).first());
  await click(page.getByText("Seed Phrase or Private Key", { exact: true }).first());
  await waitForRoute(page, "seed-or-key");

  const words = page.locator('input[type="password"]');
  await page
    .context()
    .grantPermissions(["clipboard-read", "clipboard-write"])
    .catch(() => {});

  const lastFilled = async (): Promise<boolean> => {
    const value = await words
      .nth(seedWords.length - 1)
      .inputValue()
      .catch(() => "");

    return value.trim().length > 0;
  };

  await click(words.first());
  await page.evaluate((phrase) => navigator.clipboard.writeText(phrase), seedWords.join(" "));
  await page.keyboard.press("ControlOrMeta+v");
  const pasted = await waitUntil(lastFilled, { timeoutMs: SEED_PASTE_TIMEOUT_MS });

  if (pasted === undefined) {
    for (const [index, word] of seedWords.entries()) {
      const box = words.nth(index);
      await click(box);
      await box.fill(word);
    }
  }

  await click(page.getByRole("button", { exact: true, name: "Next" }).first());

  await waitForRoute(page, "set-password");
  const passwords = page.locator('input[type="password"]');
  await waitShown(passwords.nth(1));
  await passwords.nth(0).fill(password);
  await passwords.nth(1).fill(password);
  await click(page.getByRole("button", { exact: true, name: "Confirm" }).first());

  await waitShown(page.getByText("Address Imported", { exact: false }).first());
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

  extensionName: RABBY,

  importWallet,

  onboardingPage: ONBOARDING_ROUTE,

  source: { id: "acmacodkjbdgmoleebolmdjonilkdbch", kind: "webStore" },

  unlockScreen: { entry: "index.html" },
};
