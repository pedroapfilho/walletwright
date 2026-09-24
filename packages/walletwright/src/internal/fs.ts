import { rename, stat } from "node:fs/promises";

/** Run `operation`, answering `fallback` instead of throwing when its target does not exist. */
const unlessMissing = async <T>(operation: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
};

export const pathExists = (target: string): Promise<boolean> =>
  unlessMissing(async () => {
    await stat(target);
    return true;
  }, false);

/** `rename`, reporting whether `from` existed to be moved rather than throwing when it did not. */
export const renameIfExists = (from: string, to: string): Promise<boolean> =>
  unlessMissing(async () => {
    await rename(from, to);
    return true;
  }, false);
