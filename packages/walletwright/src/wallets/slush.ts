import type { Page } from "@playwright/test";

import { clicksFor } from "../internal/click";
import { sleep, waitUntilOrThrow } from "../internal/wait";
import type { WalletDefinition } from "../types";

const HOME_ROUTE = "#/tokens";

const IMPORT_HOME_TIMEOUT_MS = 30_000;
const PERSIST_TIMEOUT_MS = 60_000;
const PASSPHRASE_SCREEN_TIMEOUT_MS = 20_000;
const PASSPHRASE_SCREEN_ATTEMPTS = 3;

const SECRETS_DATABASE = "keyval-store";
const SECRETS_STORE = "keyval";
const SESSION_TOKEN_KEY = "anonymous-session-token";
const PASSWORD_HASH_KEY = "password_hash";
const PASSPHRASE_KEY_PREFIX = "mnemonic__";

const FORCED = { force: true } as const;
/** Slush mounts its welcome controls before wiring their handlers, and an early click is a no-op. */
const WELCOME_CONTROL = { ...FORCED, settleMs: 1000 } as const;
/** Its approval window reports controls visible about two seconds before their handlers wire up. */
const APPROVAL_SETTLE_MS = 2000;

const { click } = clicksFor("Slush");

const labelled = (page: Page, text: string) => page.getByText(text, { exact: true }).first();

const atHome = async (page: Page): Promise<boolean> =>
  (await page.evaluate(() => globalThis.location.hash).catch(() => "")) === HOME_ROUTE;

/**
 * Slush keeps the imported account on its backend, and on the device only the session that owns it,
 * the encrypted passphrase and the password hash, each written on its own. Reaching the home route
 * does not mean all three are on disk, and a profile cached without one cannot unlock or sign.
 */
const walletPersisted = (page: Page): Promise<boolean> =>
  page.evaluate(
    async ({ databaseName, passphrasePrefix, required, storeName }) => {
      const databases = await indexedDB.databases();
      if (!databases.some((database) => database.name === databaseName)) {
        return false;
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
          return false;
        }
        const request = database
          .transaction(storeName, "readonly")
          .objectStore(storeName)
          .getAllKeys();
        const keys = await new Promise<Array<IDBValidKey>>((resolve, reject) => {
          request.addEventListener("success", () => {
            resolve(request.result);
          });
          request.addEventListener("error", () => {
            reject(request.error ?? new Error(`Unable to read ${storeName}`));
          });
        });
        const names = keys.filter((key) => typeof key === "string");
        return (
          required.every((name) => names.includes(name)) &&
          names.some((name) => name.startsWith(passphrasePrefix))
        );
      } finally {
        database.close();
      }
    },
    {
      databaseName: SECRETS_DATABASE,
      passphrasePrefix: PASSPHRASE_KEY_PREFIX,
      required: [SESSION_TOKEN_KEY, PASSWORD_HASH_KEY],
      storeName: SECRETS_STORE,
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
      await click(labelled(page, "Get started"), WELCOME_CONTROL);
      await click(labelled(page, "Skip"), WELCOME_CONTROL);
      await click(labelled(page, "Maybe later"), WELCOME_CONTROL);
      await click(labelled(page, "Passphrase"), WELCOME_CONTROL);
      // Unforced: the link reports visible while its row is still collapsed, so the click has to
      // wait for the row to open over it.
      await click(page.locator('a[href$="#/ImportPassphrase"]'));
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
  /** Connect confirms with Approve, signing with Sign. */
  approval: {
    cancel: (popup) => popup.locator("button").filter({ hasText: /^Reject$/v }),
    click: { kind: "locator", settleMs: APPROVAL_SETTLE_MS },
    confirm: (popup) => popup.locator("button").filter({ hasText: /^(?:Approve|Sign)$/v }),
    urlMatch: "isPopup=1",
  },

  ecosystems: ["sui"],

  extensionName: "Slush",

  importWallet: async (page, seedPhrase, password) => {
    await openPassphraseImport(page);

    const words = seedPhrase.trim().split(/\s+/v);
    for (let i = 0; i < words.length; i++) {
      await page.getByLabel(`Word ${i + 1}`, { exact: true }).fill(words[i] ?? "");
    }
    await click(page.getByRole("button", { exact: true, name: "Import" }));

    await page.getByPlaceholder("Password", { exact: true }).fill(password);
    await page.getByPlaceholder("Re-enter password", { exact: true }).fill(password);
    await click(page.getByRole("button", { exact: true, name: "Next" }));

    await click(page.getByRole("button", { exact: true, name: "Dive into Slush" }));
    await waitUntilOrThrow(() => atHome(page), {
      intervalMs: 1000,
      message: `Slush import never reached the wallet home (${HOME_ROUTE})`,
      timeoutMs: IMPORT_HOME_TIMEOUT_MS,
    });
    await waitUntilOrThrow(() => walletPersisted(page), {
      intervalMs: 1000,
      message: "Slush import never persisted its session, passphrase and password hash",
      timeoutMs: PERSIST_TIMEOUT_MS,
    });
  },

  onboardingPage: "index.html",

  source: { id: "opcgpfmipidbgpenhmajoajpbobppdil", kind: "webStore" },

  unlockScreen: {
    entry: "index.html",
    isUnlocked: atHome,
    // Unforced: the lock form slides in, and its button stays disabled until the password registers.
    submit: async (page) => {
      await click(page.getByRole("button", { exact: true, name: "Unlock" }));
    },
  },
};
