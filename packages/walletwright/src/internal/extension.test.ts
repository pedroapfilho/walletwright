import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { wallets } from "../wallets/index";

import { extensionArchive, extensionIdFromPath } from "./extension";

describe("extensionArchive", () => {
  it("resolves the default release when the setup pins no version", () => {
    expect(extensionArchive(wallets.metamask, undefined)).toMatchObject({
      format: "zip",
      sha256: expect.stringMatching(/^[0-9a-f]{64}$/v),
    });
  });

  it("resolves the release the setup pins", () => {
    expect(extensionArchive(wallets.metamask, "13.0.0")).toMatchObject({
      name: "metamask-chrome-13.0.0",
      sha256: undefined,
    });
  });

  it("keeps each Web Store wallet in its own latest-build directory", () => {
    expect(extensionArchive(wallets.phantom, undefined)).toEqual({
      format: "crx",
      name: "webstore-bfnaelmomeimhlpmgjnjophhpkkoljpa",
      sha256: undefined,
      url: "https://clients2.google.com/service/update2/crx?response=redirect&prodversion=130.0&acceptformat=crx2,crx3&x=id%3Dbfnaelmomeimhlpmgjnjophhpkkoljpa%26uc",
    });
    expect(extensionArchive(wallets.slush, undefined).url).toBe(
      "https://clients2.google.com/service/update2/crx?response=redirect&prodversion=130.0&acceptformat=crx2,crx3&x=id%3Dopcgpfmipidbgpenhmajoajpbobppdil%26uc",
    );
  });

  it("refuses a version for a Web Store wallet instead of ignoring it", () => {
    expect(() => extensionArchive(wallets.phantom, "1.0.0")).toThrow(
      /Phantom runs its Chrome Web Store build, which cannot be pinned/v,
    );
  });
});

const tempDirs: Array<string> = [];

afterAll(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { force: true, recursive: true })));
});

/** An unpacked extension directory whose manifest has the given fields. */
const unpacked = async (manifest: Record<string, string> = {}): Promise<string> => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "walletwright-extension-test-"));
  tempDirs.push(dir);
  await writeFile(path.join(dir, "manifest.json"), JSON.stringify({ name: "x", ...manifest }));

  return dir;
};

describe("extensionIdFromPath", () => {
  it("derives a 32-letter a..p id from the path when the manifest has no key", async () => {
    const dir = await unpacked();

    await expect(extensionIdFromPath(dir)).resolves.toMatch(/^[a-p]{32}$/v);
    expect(await extensionIdFromPath(dir)).not.toBe(await extensionIdFromPath(await unpacked()));
  });

  it("hashes the real path, so a symlinked directory gets the id Chrome gives it", async () => {
    const dir = await unpacked();
    const link = `${dir}-link`;
    tempDirs.push(link);
    await symlink(dir, link);

    expect(await extensionIdFromPath(link)).toBe(await extensionIdFromPath(dir));
  });

  it("derives the id from the manifest key wherever the extension is unpacked", async () => {
    const key = Buffer.from("a public key").toString("base64");
    const first = await extensionIdFromPath(await unpacked({ key }));

    expect(first).toMatch(/^[a-p]{32}$/v);
    expect(await extensionIdFromPath(await unpacked({ key }))).toBe(first);
    expect(await extensionIdFromPath(await unpacked())).not.toBe(first);
  });

  it("fails on a directory with no manifest instead of guessing an id", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "walletwright-extension-test-"));
    tempDirs.push(dir);

    await expect(extensionIdFromPath(dir)).rejects.toThrow(/ENOENT/v);
  });
});
