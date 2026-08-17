import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";

import AdmZip from "adm-zip";
import { afterEach, describe, expect, it } from "vitest";

import { chromeWebStoreCrxUrl, downloadAndExtractExtension } from "./download";

const serve = async (bytes: Buffer): Promise<{ close: () => Promise<void>; url: string }> => {
  const server: Server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/octet-stream" });
    res.end(bytes);
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return {
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      }),
    url: `http://127.0.0.1:${port}/ext.zip`,
  };
};

const cacheDirs: Array<string> = [];
const servers: Array<{ close: () => Promise<void> }> = [];

const makeCacheDir = async (): Promise<string> => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "walletwright-download-test-"));
  cacheDirs.push(dir);
  return dir;
};

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  await Promise.all(cacheDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("downloadAndExtractExtension", () => {
  it("extracts a benign archive containing manifest.json", async () => {
    const zip = new AdmZip();
    zip.addFile("manifest.json", Buffer.from('{"name":"fake"}'));
    const { close, url } = await serve(zip.toBuffer());
    servers.push({ close });

    const cacheDir = await makeCacheDir();
    const outDir = await downloadAndExtractExtension({
      cacheDir,
      kind: "zip",
      name: "fake-extension",
      sha256: undefined,
      url,
    });

    expect(existsSync(path.join(outDir, "manifest.json"))).toBe(true);
  });

  it("rejects a name that escapes the cache dir", async () => {
    const zip = new AdmZip();
    zip.addFile("manifest.json", Buffer.from('{"name":"fake"}'));
    const { close, url } = await serve(zip.toBuffer());
    servers.push({ close });

    const cacheDir = await makeCacheDir();
    await expect(
      downloadAndExtractExtension({
        cacheDir,
        kind: "zip",
        name: "../escape",
        sha256: undefined,
        url,
      }),
    ).rejects.toThrow(/invalid extension name/v);
  });

  it("rejects a name that resolves to the cache root itself", async () => {
    const cacheDir = await makeCacheDir();
    await expect(
      downloadAndExtractExtension({
        cacheDir,
        kind: "zip",
        name: ".",
        sha256: undefined,
        url: "http://127.0.0.1:1/unused.zip",
      }),
    ).rejects.toThrow(/invalid extension name/v);
  });

  it("rejects a zip entry that escapes the extraction dir", async () => {
    const zip = new AdmZip();
    zip.addFile("manifest.json", Buffer.from('{"name":"fake"}'));
    zip.addFile("placeholder.txt", Buffer.from("evil"));
    const entries = zip.getEntries();
    entries[1].entryName = "../escape.txt";
    const { close, url } = await serve(zip.toBuffer());
    servers.push({ close });

    const cacheDir = await makeCacheDir();
    await expect(
      downloadAndExtractExtension({
        cacheDir,
        kind: "zip",
        name: "evil-extension",
        sha256: undefined,
        url,
      }),
    ).rejects.toThrow(/escapes/v);
  });

  it("extracts when the given sha256 matches the downloaded bytes", async () => {
    const zip = new AdmZip();
    zip.addFile("manifest.json", Buffer.from('{"name":"fake"}'));
    const bytes = zip.toBuffer();
    const { close, url } = await serve(bytes);
    servers.push({ close });

    const cacheDir = await makeCacheDir();
    const outDir = await downloadAndExtractExtension({
      cacheDir,
      kind: "zip",
      name: "hashed-extension",
      sha256: createHash("sha256").update(bytes).digest("hex"),
      url,
    });

    expect(existsSync(path.join(outDir, "manifest.json"))).toBe(true);
  });

  it("throws when the given sha256 does not match the downloaded bytes", async () => {
    const zip = new AdmZip();
    zip.addFile("manifest.json", Buffer.from('{"name":"fake"}'));
    const { close, url } = await serve(zip.toBuffer());
    servers.push({ close });

    const cacheDir = await makeCacheDir();
    await expect(
      downloadAndExtractExtension({
        cacheDir,
        kind: "zip",
        name: "wrong-hash-extension",
        sha256: "0".repeat(64),
        url,
      }),
    ).rejects.toThrow(/failed integrity check/v);
  });

  it("extracts when the download is explicitly unpinned", async () => {
    const zip = new AdmZip();
    zip.addFile("manifest.json", Buffer.from('{"name":"fake"}'));
    const { close, url } = await serve(zip.toBuffer());
    servers.push({ close });

    const cacheDir = await makeCacheDir();
    const outDir = await downloadAndExtractExtension({
      cacheDir,
      kind: "zip",
      name: "no-hash-extension",
      sha256: undefined,
      url,
    });

    expect(existsSync(path.join(outDir, "manifest.json"))).toBe(true);
  });

  it("reuses an existing extraction without hitting the server", async () => {
    const cacheDir = await makeCacheDir();
    const outDir = path.join(cacheDir, "pre-placed");
    await mkdir(outDir, { recursive: true });
    await writeFile(path.join(outDir, "manifest.json"), '{"name":"pre-placed"}');

    // An unreachable URL proves the fast path never fetched.
    await expect(
      downloadAndExtractExtension({
        cacheDir,
        kind: "zip",
        name: "pre-placed",
        sha256: undefined,
        url: "http://127.0.0.1:1/unused.zip",
      }),
    ).resolves.toBe(outDir);
  });

  it("leaves no staging directory behind, so a completed extraction is the only state", async () => {
    const zip = new AdmZip();
    zip.addFile("manifest.json", Buffer.from('{"name":"fake"}'));
    zip.addFile("background.js", Buffer.from("// noop"));
    const { close, url } = await serve(zip.toBuffer());
    servers.push({ close });

    const cacheDir = await makeCacheDir();
    await downloadAndExtractExtension({
      cacheDir,
      kind: "zip",
      name: "staged-extension",
      sha256: undefined,
      url,
    });

    expect(await readdir(cacheDir)).toEqual(["staged-extension"]);
  });

  it("does not publish a partial extraction when the archive escapes mid-extract", async () => {
    const zip = new AdmZip();
    zip.addFile("manifest.json", Buffer.from('{"name":"fake"}'));
    zip.addFile("placeholder.txt", Buffer.from("evil"));
    zip.getEntries()[1].entryName = "../escape.txt";
    const { close, url } = await serve(zip.toBuffer());
    servers.push({ close });

    const cacheDir = await makeCacheDir();
    await expect(
      downloadAndExtractExtension({
        cacheDir,
        kind: "zip",
        name: "aborted-extension",
        sha256: undefined,
        url,
      }),
    ).rejects.toThrow(/escapes/v);

    // Neither a poisoned `<name>` a later run would trust, nor a leftover staging dir.
    expect(existsSync(path.join(cacheDir, "aborted-extension"))).toBe(false);
    expect(await readdir(cacheDir)).toEqual([]);
  });

  it("keeps a previously published extraction when a later download fails", async () => {
    const cacheDir = await makeCacheDir();
    const outDir = path.join(cacheDir, "kept-extension");
    await mkdir(outDir, { recursive: true });
    await writeFile(path.join(outDir, "other.txt"), "first build");

    const { close, url } = await serve(Buffer.from("not a zip"));
    servers.push({ close });

    await expect(
      downloadAndExtractExtension({
        cacheDir,
        kind: "zip",
        name: "kept-extension",
        sha256: undefined,
        url,
      }),
    ).rejects.toThrow();

    expect(existsSync(path.join(outDir, "other.txt"))).toBe(true);
  });
});

describe("chromeWebStoreCrxUrl", () => {
  it("builds the Phantom Web Store CRX url", () => {
    expect(chromeWebStoreCrxUrl("bfnaelmomeimhlpmgjnjophhpkkoljpa")).toBe(
      "https://clients2.google.com/service/update2/crx?response=redirect&prodversion=130.0&acceptformat=crx2,crx3&x=id%3Dbfnaelmomeimhlpmgjnjophhpkkoljpa%26uc",
    );
  });

  it("builds the Slush Web Store CRX url", () => {
    expect(chromeWebStoreCrxUrl("opcgpfmipidbgpenhmajoajpbobppdil")).toBe(
      "https://clients2.google.com/service/update2/crx?response=redirect&prodversion=130.0&acceptformat=crx2,crx3&x=id%3Dopcgpfmipidbgpenhmajoajpbobppdil%26uc",
    );
  });
});
