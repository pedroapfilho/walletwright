import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import type { OnboardedWallet, WalletDefinition } from "./definition";
import {
  type EngineSetup,
  extensionIndexedDbDir,
  extensionStateDir,
  locate,
  publishProfile,
} from "./profile";
import { gotoExtensionPage, openSession, type WalletSession } from "./session";
import { waitUntilOrThrow } from "./wait";

const PERSIST_TIMEOUT_MS = 60_000;
const PERSIST_INTERVAL_MS = 500;

/**
 * Longer than a wallet takes to start its debounced write after its last onboarding screen (measured
 * locally: Rabby 0.8s, MetaMask 1.3s), so storage that changed and then held still this long is done.
 */
const STORAGE_QUIET_MS = 2000;

/** Every file of the extension's `chrome.storage.local` and IndexedDB, with its size. */
const listStorage = async (profileDir: string, extensionId: string): Promise<string> => {
  const stores = [
    extensionStateDir(profileDir, extensionId),
    extensionIndexedDbDir(profileDir, extensionId),
  ];

  const files = await Promise.all(
    stores.map(async (dir) => {
      const names = await readdir(dir).catch(() => []);

      return Promise.all(
        names.map(async (name) => {
          const size = await stat(path.join(dir, name)).then(
            (file) => file.size,
            () => -1,
          );

          return `${dir}/${name}:${size}`;
        }),
      );
    }),
  );

  return files.flat().join("\n");
};

/**
 * Take the extension's storage as it is now, and return a check that holds once it has changed since
 * and then stayed still for `STORAGE_QUIET_MS`. Counting from the first change, not from the call,
 * keeps a wallet that writes nothing until well after its last screen from passing on silence.
 */
const storageSettles = async (
  profileDir: string,
  extensionId: string,
): Promise<() => Promise<boolean>> => {
  const before = await listStorage(profileDir, extensionId);
  let listing = before;
  let changedAt = Date.now();

  return async () => {
    const current = await listStorage(profileDir, extensionId);

    if (current !== listing) {
      listing = current;
      changedAt = Date.now();
    }

    return listing !== before && Date.now() - changedAt >= STORAGE_QUIET_MS;
  };
};

const onboard = async (
  definition: WalletDefinition,
  setup: EngineSetup,
  { context, extensionId, userDataDir }: WalletSession,
): Promise<void> => {
  const page =
    context.pages().find((candidate) => candidate.url() === "about:blank") ??
    (await context.newPage());

  await gotoExtensionPage(page, {
    extensionId,
    path: definition.onboardingPage,
    wallet: definition.extensionName,
  });

  const isPersisted: (onboarded: OnboardedWallet) => Promise<boolean> =
    definition.isPersisted ?? (await storageSettles(userDataDir, extensionId));

  await definition.importWallet(page, setup.seedPhrase.trim().split(/\s+/v), setup.password);
  await waitUntilOrThrow(() => isPersisted({ extensionId, page, profileDir: userDataDir }), {
    intervalMs: PERSIST_INTERVAL_MS,
    message: `${definition.extensionName} never persisted the onboarded wallet into ${userDataDir}`,
    timeoutMs: PERSIST_TIMEOUT_MS,
  });
};

/** Build in staging and retain the prior cache until the new profile publishes successfully. */
export const build = async (
  definition: WalletDefinition,
  setup: EngineSetup,
  { headless = false }: { headless?: boolean } = {},
): Promise<string> => {
  const location = locate(definition, setup);

  const { session } = await openSession(
    { definition, extension: location.extension, headless, profile: location.build },
    (opened) => onboard(definition, setup, opened),
  );

  await session.close(async () => {
    await definition.finalizeCache?.(session.userDataDir, session.extensionId);
    await publishProfile(session.userDataDir, location.profileDir);
  });

  return location.profileDir;
};
