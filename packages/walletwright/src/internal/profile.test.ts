import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { WalletSetup } from "../types";
import { wallets } from "../wallets/index";

import { extensionArchive } from "./extension";
import { copyProfile, profileKey, publishProfile } from "./profile";

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

const archiveName = "metamask-chrome-13.35.1";

describe("profileKey", () => {
  it("returns a 20-character lowercase hex string", () => {
    const key = profileKey(baseSetup, archiveName);
    expect(key).toMatch(/^[0-9a-f]{20}$/v);
  });

  it("is deterministic for the same setup", () => {
    expect(profileKey(baseSetup, archiveName)).toBe(profileKey({ ...baseSetup }, archiveName));
  });

  it("changes when the wallet changes", () => {
    expect(profileKey({ ...baseSetup, wallet: "phantom" }, archiveName)).not.toBe(
      profileKey(baseSetup, archiveName),
    );
  });

  it("changes when the version changes", () => {
    expect(profileKey(baseSetup, "metamask-chrome-1.2.3")).not.toBe(
      profileKey(baseSetup, archiveName),
    );
  });

  it("selects a different profile when an omitted version resolves to a new default", () => {
    const definition = wallets.metamask;

    if (definition.source.kind !== "release") {
      throw new Error("expected a release source");
    }

    const current = extensionArchive(definition, baseSetup);

    const updated = extensionArchive(
      {
        ...definition,
        source: { ...definition.source, defaultVersion: "13.36.0" },
      },
      baseSetup,
    );

    expect(profileKey(baseSetup, updated.name)).not.toBe(profileKey(baseSetup, current.name));
  });

  it("shares the profile for an explicit and default version of the same release", () => {
    const implicit = extensionArchive(wallets.metamask, baseSetup);
    const source = wallets.metamask.source;

    if (source.kind !== "release") {
      throw new Error("expected a release source");
    }

    const explicitSetup = { ...baseSetup, version: source.defaultVersion };
    const explicit = extensionArchive(wallets.metamask, explicitSetup);
    expect(profileKey(explicitSetup, explicit.name)).toBe(profileKey(baseSetup, implicit.name));
  });

  it("changes when the seed phrase changes", () => {
    expect(
      profileKey({ ...baseSetup, seedPhrase: "different seed phrase entirely" }, archiveName),
    ).not.toBe(profileKey(baseSetup, archiveName));
  });

  it("changes when the password changes", () => {
    expect(profileKey({ ...baseSetup, password: "different-password" }, archiveName)).not.toBe(
      profileKey(baseSetup, archiveName),
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
    expect(await readdir(cacheDir)).toEqual([".locks", "profile"]);
  });

  it("recovers a previous profile left by an interrupted publication", async () => {
    const cacheDir = await makeTempDir();
    const profileDir = path.join(cacheDir, "profile");
    const previous = `${profileDir}.previous`;
    await mkdir(previous);
    await writeFile(path.join(previous, "state"), "old");

    await copyProfile(profileDir, path.join(cacheDir, "copy"));

    await expect(readFile(path.join(profileDir, "state"), "utf8")).resolves.toBe("old");
    expect(await readdir(cacheDir)).toEqual([".locks", "copy", "profile"]);
  });
});
