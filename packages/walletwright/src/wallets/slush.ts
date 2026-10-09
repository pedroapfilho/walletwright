import type { Page } from "@playwright/test";

import { clicksFor } from "../internal/click";
import { sleep, waitUntilOrThrow } from "../internal/wait";
import type { WalletDefinition } from "../types";

const HOME_ROUTE = "#/tokens";

const IMPORT_HOME_TIMEOUT_MS = 30_000;
const PERSIST_TIMEOUT_MS = 60_000;
const PASSPHRASE_SCREEN_TIMEOUT_MS = 20_000;
const PASSPHRASE_SCREEN_ATTEMPTS = 3;

const ACCOUNTS_DATABASE = "signaldb-accounts";
const PREFERENCES_DATABASE = "signaldb-preferences";
const ITEMS_STORE = "items";

/** Slush's controls are not native buttons, so every click on one is forced. */
const FORCED = { force: true } as const;
/** Slush mounts its welcome controls before wiring their handlers, and an early click is a no-op. */
const WELCOME_CONTROL = { ...FORCED, settleMs: 1000 } as const;
const POPUP_CONTROL = { ...FORCED, timeoutMs: 15_000 } as const;
/** Short, so a signing popup, which has no Approve, falls through to Sign quickly. */
const APPROVE_PROBE = { ...FORCED, timeoutMs: 4000 } as const;

const { click, clickIfShown } = clicksFor("Slush");

const labelled = (page: Page, text: string) => page.getByText(text, { exact: true }).first();

const atHome = async (page: Page): Promise<boolean> =>
  (await page.evaluate(() => globalThis.location.hash).catch(() => "")) === HOME_ROUTE;

/**
 * Slush writes the imported account, its provider and the preferences row that selects it in
 * separate transactions, so reaching the home route does not mean the profile is durable yet.
 * Caching between those writes yields a profile that unlocks to an account-less wallet.
 */
const walletPersisted = (page: Page): Promise<boolean> =>
  page.evaluate(
    async ({ accountsDatabase, preferencesDatabase, storeName }) => {
      const readItems = async (databaseName: string): Promise<Array<object>> => {
        const databases = await indexedDB.databases();
        if (!databases.some((database) => database.name === databaseName)) {
          return [];
        }

        const database = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open(databaseName);
          request.addEventListener("success", () => {
            resolve(request.result);
          });
          request.addEventListener("error", () => {
            reject(request.error ?? new Error(`Unable to open ${databaseName}`));
          });
        });

        try {
          if (!database.objectStoreNames.contains(storeName)) {
            return [];
          }
          const store = database.transaction(storeName, "readonly").objectStore(storeName);
          const request = store.getAll();
          return await new Promise<Array<object>>((resolve, reject) => {
            request.addEventListener("success", () => {
              resolve(request.result.filter((item) => typeof item === "object" && item !== null));
            });
            request.addEventListener("error", () => {
              reject(request.error ?? new Error(`Unable to read ${storeName}`));
            });
          });
        } finally {
          database.close();
        }
      };

      const accounts = await readItems(accountsDatabase);
      const accountIds = new Set<string>();
      for (const account of accounts) {
        if ("id" in account && typeof account.id === "string") {
          accountIds.add(account.id);
        }
      }
      if (accountIds.size === 0) {
        return false;
      }

      const preferences = await readItems(preferencesDatabase);
      return preferences.some(
        (preference) =>
          "currentAccountId" in preference &&
          typeof preference.currentAccountId === "string" &&
          accountIds.has(preference.currentAccountId),
      );
    },
    {
      accountsDatabase: ACCOUNTS_DATABASE,
      preferencesDatabase: PREFERENCES_DATABASE,
      storeName: ITEMS_STORE,
    },
  );

/**
 * On a slow runner a welcome click can still land before Slush responds, leaving the page where it
 * was. Reloading the welcome screen and starting over recovers it, so an attempt that fails is
 * retried, and the last failure is the cause if every attempt does.
 */
const openPassphraseImport = async (page: Page): Promise<void> => {
  const firstWord = page.getByLabel("Word 1", { exact: true });
  let failure: unknown;
  for (let attempt = 0; attempt < PASSPHRASE_SCREEN_ATTEMPTS; attempt++) {
    try {
      await click(labelled(page, "More options"), WELCOME_CONTROL);
      await click(labelled(page, "Import existing from passphrase"), WELCOME_CONTROL);
      await firstWord.waitFor({ state: "visible", timeout: PASSPHRASE_SCREEN_TIMEOUT_MS });
      return;
    } catch (error) {
      failure = error;
    }
    await page.goto(page.url().split("#")[0] ?? page.url());
    await sleep(2000);
  }
  throw new Error(
    `[walletwright] Slush never opened the passphrase import screen after ${PASSPHRASE_SCREEN_ATTEMPTS} attempts`,
    { cause: failure },
  );
};

export const slush: WalletDefinition = {
  approve: async (popup, password) => {
    await sleep(2000);
    const confirmed =
      (await clickIfShown(labelled(popup, "Approve"), APPROVE_PROBE)) ||
      (await clickIfShown(labelled(popup, "Sign"), POPUP_CONTROL));
    if (!confirmed) {
      throw new Error("[walletwright] Slush approval: neither Approve nor Sign was actionable");
    }
    await sleep(1500);
    const input = popup.locator('input[type="password"]');
    if (await input.isVisible().catch(() => false)) {
      await input.fill(password);
      await clickIfShown(labelled(popup, "Unlock"), POPUP_CONTROL);
    }
  },

  ecosystems: ["sui"],

  extensionName: "Slush",

  importWallet: async (page, seedPhrase, password) => {
    await openPassphraseImport(page);

    const words = seedPhrase.trim().split(/\s+/v);
    for (let i = 0; i < words.length; i++) {
      await page.getByLabel(`Word ${i + 1}`, { exact: true }).fill(words[i] ?? "");
    }
    const next = page.getByRole("button", { name: "Next" });
    await click(next);
    await sleep(2000);

    await page.locator('input[placeholder="Password"]').fill(password);
    await page.locator('input[placeholder="Confirm Password"]').fill(password);
    await click(next);
    await sleep(2000);

    await clickIfShown(next);
    await waitUntilOrThrow(() => atHome(page), {
      intervalMs: 1000,
      message: `Slush import never reached the wallet home (${HOME_ROUTE})`,
      timeoutMs: IMPORT_HOME_TIMEOUT_MS,
    });
    await waitUntilOrThrow(() => walletPersisted(page), {
      intervalMs: 1000,
      message: "Slush import never persisted an account and its selected preference",
      timeoutMs: PERSIST_TIMEOUT_MS,
    });
  },

  notificationMatch: "isPopup=1",

  onboardingPage: "index.html",

  prepareContext: async (context) => {
    await context.route("**://*.slush.app/**", (route) =>
      route.fulfill({
        body: JSON.stringify({ data: {} }),
        contentType: "application/json",
        status: 200,
      }),
    );
  },

  reject: async (popup) => {
    await sleep(2000);
    if (!(await clickIfShown(labelled(popup, "Reject"), POPUP_CONTROL))) {
      throw new Error("[walletwright] Slush reject: no Reject control was actionable");
    }
  },

  source: { id: "opcgpfmipidbgpenhmajoajpbobppdil", kind: "webStore" },

  unlockScreen: {
    entry: "index.html",
    isUnlocked: atHome,
    submit: async (page) => {
      await click(labelled(page, "Unlock"), FORCED);
    },
  },
};
