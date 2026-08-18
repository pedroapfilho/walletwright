import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WalletSetup } from "../types";

import {
  type BuildCacheDependencies,
  buildCacheWithDependencies,
  publishProfile,
  restorePreviousProfile,
} from "./cache";

const launchPersistentContext = vi.fn<BuildCacheDependencies["launchPersistentContext"]>();
const prepareExtension = vi.fn<BuildCacheDependencies["prepareExtension"]>();
const dependencies: BuildCacheDependencies = { launchPersistentContext, prepareExtension };

const tempDirs: Array<string> = [];
const setup: WalletSetup = {
  password: "pw",
  seedPhrase: "test seed",
  wallet: "metamask",
};

const makeTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "walletwright-cache-test-"));
  tempDirs.push(dir);
  return dir;
};

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(async () => {
  await Promise.allSettled(
    tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })),
  );
});

describe("buildCache", () => {
  it("removes staging when Chromium fails to launch", async () => {
    const cacheDir = await makeTempDir();
    prepareExtension.mockResolvedValue(path.join(cacheDir, "extension"));
    launchPersistentContext.mockRejectedValue(new Error("launch failed"));

    await expect(
      buildCacheWithDependencies({ ...setup, cacheDir }, {}, dependencies),
    ).rejects.toThrow("launch failed");

    expect(await readdir(cacheDir)).toEqual([]);
  });
});

describe("publishProfile", () => {
  it("restores the previous profile when publication fails", async () => {
    const cacheDir = await makeTempDir();
    const profileDir = path.join(cacheDir, "profile");
    await mkdir(profileDir);
    await writeFile(path.join(profileDir, "state"), "old");

    await expect(publishProfile(path.join(cacheDir, "missing"), profileDir)).rejects.toThrow();

    await expect(readFile(path.join(profileDir, "state"), "utf8")).resolves.toBe("old");
    expect(await readdir(cacheDir)).toEqual(["profile"]);
  });

  it("recovers a previous profile left by an interrupted publication", async () => {
    const cacheDir = await makeTempDir();
    const profileDir = path.join(cacheDir, "profile");
    const previous = `${profileDir}.previous`;
    await mkdir(previous);
    await writeFile(path.join(previous, "state"), "old");

    await restorePreviousProfile(profileDir);

    await expect(readFile(path.join(profileDir, "state"), "utf8")).resolves.toBe("old");
    expect(await readdir(cacheDir)).toEqual(["profile"]);
  });
});
