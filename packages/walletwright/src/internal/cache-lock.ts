import { createHash } from "node:crypto";
import { mkdir, realpath } from "node:fs/promises";
import path from "node:path";
import { setTimeout } from "node:timers/promises";

import { ClassicLevel } from "classic-level";

const LOCK_TIMEOUT_MS = 60_000;

/** LevelDB's OS lock releases on process exit; its directory must stay put between owners. */
export const withArtifactLock = async <T>(
  artifact: string,
  operation: () => Promise<T>,
): Promise<T> => {
  const parent = path.dirname(path.resolve(artifact));
  await mkdir(parent, { recursive: true });
  const lockRoot = path.join(await realpath(parent), ".locks");
  await mkdir(lockRoot, { recursive: true });
  const key = createHash("sha256").update(path.basename(artifact)).digest("hex");
  const lock = new ClassicLevel(path.join(lockRoot, key));
  const deadline = Date.now() + LOCK_TIMEOUT_MS;

  while (true) {
    try {
      await lock.open();
      break;
    } catch (error) {
      const cause = error instanceof Error ? error.cause : undefined;

      if (!(cause instanceof Error && "code" in cause && cause.code === "LEVEL_LOCKED")) {
        throw error;
      }

      if (Date.now() >= deadline) {
        throw new Error(`[walletwright] timed out waiting for cache ownership at ${artifact}`, {
          cause: error,
        });
      }

      await setTimeout(25);
    }
  }

  try {
    return await operation();
  } finally {
    await lock.close();
  }
};
