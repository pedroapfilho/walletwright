import { cp, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { ClassicLevel } from "classic-level";
import { z } from "zod";

import { extensionStateDir } from "../../internal/profile";
import type { OnboardedWallet } from "../../types";

const keyringSchema = z.object({ vault: z.string().min(1) });
const dataSchema = z.union([
  z.object({ KeyringController: keyringSchema }),
  z.object({ data: z.object({ KeyringController: keyringSchema }) }),
]);

const holdsVault = async (db: ClassicLevel): Promise<boolean> => {
  const perController = await db.get("KeyringController");
  if (perController !== undefined) {
    return keyringSchema.safeParse(JSON.parse(perController)).success;
  }
  const data = await db.get("data");
  return data !== undefined && dataSchema.safeParse(JSON.parse(data)).success;
};

/**
 * Whether MetaMask's vault is in its `chrome.storage.local`. MetaMask writes it on a debounce, with
 * the accounts, about 1.3s after its last onboarding screen (measured), so reaching that screen does
 * not mean the profile can unlock. The open browser holds the LevelDB lock, so this reads a copy.
 */
export const isMetaMaskPersisted = async ({
  extensionId,
  profileDir,
}: OnboardedWallet): Promise<boolean> => {
  const copy = await mkdtemp(path.join(os.tmpdir(), "walletwright-metamask-state-"));
  try {
    await cp(extensionStateDir(profileDir, extensionId), copy, {
      filter: (source) => path.basename(source) !== "LOCK",
      recursive: true,
    });
    const db = new ClassicLevel(copy, {
      createIfMissing: false,
      keyEncoding: "utf8",
      valueEncoding: "utf8",
    });
    await db.open();
    try {
      return await holdsVault(db);
    } finally {
      await db.close();
    }
  } catch {
    // A copy taken mid-compaction can name a file already gone; the next poll copies again.
    return false;
  } finally {
    await rm(copy, { force: true, recursive: true });
  }
};
