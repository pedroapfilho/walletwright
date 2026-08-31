import type { Page } from "@playwright/test";

import { prepareWebStoreExtension } from "../internal/download";
import { createUnlockScreen } from "../internal/unlock-screen";
import { sleep, waitUntilOrThrow } from "../internal/wait";
import type { WalletDefinition } from "../types";

const SLUSH_EXTENSION_ID = "opcgpfmipidbgpenhmajoajpbobppdil";

const HOME_ROUTE = "#/tokens";

const IMPORT_HOME_TIMEOUT_MS = 30_000;
const PERSIST_TIMEOUT_MS = 60_000;

const ACCOUNTS_DATABASE = "signaldb-accounts";
const PREFERENCES_DATABASE = "signaldb-preferences";
const ITEMS_STORE = "items";

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

const fclick = async (page: Page, text: string, timeoutMs = 15_000): Promise<boolean> => {
  const target = page.getByText(text, { exact: true }).first();
  const visible = await target
    .waitFor({ state: "visible", timeout: timeoutMs })
    .then(() => true)
    .catch(() => false);
  if (!visible) {
    return false;
  }
  await target.scrollIntoViewIfNeeded().catch(() => {});
  await target.click({ force: true, timeout: timeoutMs });
  return true;
};

const { reachUnlockScreen, unlock } = createUnlockScreen({
  entry: "index.html",
  isUnlocked: atHome,
  submit: async (page) => {
    await fclick(page, "Unlock");
  },
  wallet: "Slush",
});

export const slush: WalletDefinition = {
  approve: async (popup, password) => {
    await sleep(2000);
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
      await page.getByLabel(`Word ${i + 1}`, { exact: true }).fill(words[i] ?? "");
    }
    await page.getByRole("button", { name: "Next" }).click();
    await sleep(2000);

    await page.locator('input[placeholder="Password"]').fill(password);
    await page.locator('input[placeholder="Confirm Password"]').fill(password);
    await page.getByRole("button", { name: "Next" }).click();
    await sleep(2000);

    await page
      .getByRole("button", { name: "Next" })
      .click()
      .catch(() => {});
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

  prepareExtension: (cacheDir) =>
    prepareWebStoreExtension({
      cacheDir,
      extensionId: SLUSH_EXTENSION_ID,
      name: "slush-chrome-latest",
    }),

  reachUnlockScreen,

  reject: async (popup) => {
    await sleep(2000);
    if (!(await fclick(popup, "Reject"))) {
      throw new Error("[walletwright] Slush reject: no Reject control was actionable");
    }
  },

  unlock,
};
