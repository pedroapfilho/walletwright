import { access, cp, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { ClassicLevel } from "classic-level";
import { z } from "zod";

import { extensionStateDir } from "../../internal/profile";
import type { OnboardedWallet } from "../../types";

const stateSchema = z.record(z.string(), z.json());

type State = z.infer<typeof stateSchema>;

type Database = ClassicLevel;

/** One controller's persisted state, and how to write it back in the layout it was read from. */
type ControllerState = { save: (next: State) => Promise<void>; state: State };

const openState = async (dir: string): Promise<Database> => {
  const db = new ClassicLevel(dir, {
    createIfMissing: false,
    keyEncoding: "utf8",
    valueEncoding: "utf8",
  });

  await db.open();

  return db;
};

const parseState = (text: string, label: string): State => {
  const result = stateSchema.safeParse(JSON.parse(text));

  if (!result.success) {
    throw new Error(`[walletwright] MetaMask's ${label} state is not an object`, {
      cause: result.error,
    });
  }

  return result.data;
};

/**
 * MetaMask 13.x persists `chrome.storage.local` in one of two layouts: a key per controller (13.3x),
 * or every controller inside one `data` record, itself nested in a second `data` (13.13.x).
 */
const readController = async (db: Database, name: string): Promise<ControllerState | undefined> => {
  const own = await db.get(name);

  if (own !== undefined && own !== "") {
    return { save: (next) => db.put(name, JSON.stringify(next)), state: parseState(own, name) };
  }

  const raw = await db.get("data");

  if (raw === undefined || raw === "") {
    return undefined;
  }

  const record = parseState(raw, '"data"');
  const nested = stateSchema.safeParse(record.data);
  const controllers = nested.success ? nested.data : record;
  const controller = stateSchema.safeParse(controllers[name]);

  if (!controller.success) {
    return undefined;
  }

  return {
    save: (next) =>
      db.put(
        "data",
        JSON.stringify(
          nested.success
            ? { ...record, data: { ...nested.data, [name]: next } }
            : { ...record, [name]: next },
        ),
      ),
    state: controller.data,
  };
};

/**
 * Whether MetaMask's vault is in its `chrome.storage.local`. MetaMask writes it on a debounce, with
 * the accounts, about 1.3s after its last onboarding screen (measured), so reaching that screen does
 * not mean the profile can unlock. The open browser holds the LevelDB lock, so this reads a copy.
 */
const isMetaMaskPersisted = async ({
  extensionId,
  profileDir,
}: OnboardedWallet): Promise<boolean> => {
  const copy = await mkdtemp(path.join(os.tmpdir(), "walletwright-metamask-state-"));

  try {
    await cp(extensionStateDir(profileDir, extensionId), copy, {
      filter: (source) => path.basename(source) !== "LOCK",
      recursive: true,
    });

    const db = await openState(copy);

    try {
      const keyring = await readController(db, "KeyringController");

      return typeof keyring?.state.vault === "string" && keyring.state.vault !== "";
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

/**
 * Mark onboarding complete while the browser has released LevelDB. Its "wallet is ready" step hangs
 * under automation and leaves `completedOnboarding=false`, so the wallet would ignore dapp requests.
 */
const markMetaMaskOnboarded = async (profileDir: string, extensionId: string): Promise<void> => {
  const dbDir = extensionStateDir(profileDir, extensionId);

  try {
    await access(dbDir);
  } catch (error) {
    throw new Error(`[walletwright] MetaMask wrote no extension state to ${dbDir}`, {
      cause: error,
    });
  }

  const db = await openState(dbDir);

  try {
    const onboarding = await readController(db, "OnboardingController");

    if (onboarding === undefined) {
      throw new Error(`[walletwright] MetaMask persisted no onboarding state in ${dbDir}`);
    }

    if (onboarding.state.completedOnboarding !== true) {
      await onboarding.save({
        ...onboarding.state,
        completedOnboarding: true,
        firstTimeFlowType:
          typeof onboarding.state.firstTimeFlowType === "string"
            ? onboarding.state.firstTimeFlowType
            : "import",
        onboardingTabs: {},
      });
    }
  } finally {
    await db.close();
  }
};

export { isMetaMaskPersisted, markMetaMaskOnboarded };
