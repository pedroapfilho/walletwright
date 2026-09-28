import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { WalletSetup } from "../types";

import { profileKey, publishProfile, restorePreviousProfile } from "./profile";

const baseSetup: WalletSetup = {
  password: "correct-horse-battery-staple",
  seedPhrase: "test test test test test test test test test test test junk",
  wallet: "metamask",
};

const tempDirs: Array<string> = [];

const makeTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "walletwright-profile-test-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  await Promise.allSettled(
    tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })),
  );
});

describe("profileKey", () => {
  it("returns a 20-character lowercase hex string", () => {
    const key = profileKey(baseSetup);
    expect(key).toMatch(/^[0-9a-f]{20}$/v);
  });

  it("is deterministic for the same setup", () => {
    expect(profileKey(baseSetup)).toBe(profileKey({ ...baseSetup }));
  });

  it("changes when the wallet changes", () => {
    expect(profileKey({ ...baseSetup, wallet: "phantom" })).not.toBe(profileKey(baseSetup));
  });

  it("changes when the version changes", () => {
    expect(profileKey({ ...baseSetup, version: "1.2.3" })).not.toBe(profileKey(baseSetup));
  });

  it("changes when the seed phrase changes", () => {
    expect(profileKey({ ...baseSetup, seedPhrase: "different seed phrase entirely" })).not.toBe(
      profileKey(baseSetup),
    );
  });

  it("changes when the password changes", () => {
    expect(profileKey({ ...baseSetup, password: "different-password" })).not.toBe(
      profileKey(baseSetup),
    );
  });
});

describe("publishProfile", () => {
  it("restores the previous profile when publication fails", async () => {
    const cacheDir = await makeTempDir();
    const profileDir = path.join(cacheDir, "profile");
    await mkdir(profileDir);
    await writeFile(path.join(profileDir, "state"), "old");

    await expect(publishProfile(path.join(cacheDir, "missing"), profileDir)).rejects.toThrow(
      /ENOENT/v,
    );

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
