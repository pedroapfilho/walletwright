import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";

import AdmZip from "adm-zip";
import { afterEach, describe, expect, it } from "vitest";

import { chromeWebStoreCrxUrl, downloadAndExtractExtension } from "./download.ts";

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
        server.close(() => resolve());
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
      downloadAndExtractExtension({ cacheDir, kind: "zip", name: "../escape", url }),
    ).rejects.toThrow(/invalid extension name/v);
  });

  it("rejects a name that resolves to the cache root itself", async () => {
    const cacheDir = await makeCacheDir();
    await expect(
      downloadAndExtractExtension({
        cacheDir,
        kind: "zip",
        name: ".",
        url: "http://127.0.0.1:1/unused.zip",
      }),
    ).rejects.toThrow(/invalid extension name/v);
  });

  it("rejects a zip entry that escapes the extraction dir", async () => {
    const zip = new AdmZip();
    zip.addFile("manifest.json", Buffer.from('{"name":"fake"}'));
    // addFile() itself sanitizes a leading "../" out of the entry name, so a malicious archive is
    // simulated by adding a placeholder and rewriting its entryName directly (round-trips through
    // toBuffer() unsanitized, same as a hand-crafted malicious zip would).
    zip.addFile("placeholder.txt", Buffer.from("evil"));
    const entries = zip.getEntries();
    entries[1].entryName = "../escape.txt";
    const { close, url } = await serve(zip.toBuffer());
    servers.push({ close });

    const cacheDir = await makeCacheDir();
    await expect(
      downloadAndExtractExtension({ cacheDir, kind: "zip", name: "evil-extension", url }),
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

  it("extracts when no sha256 is given (unchanged behavior)", async () => {
    const zip = new AdmZip();
    zip.addFile("manifest.json", Buffer.from('{"name":"fake"}'));
    const { close, url } = await serve(zip.toBuffer());
    servers.push({ close });

    const cacheDir = await makeCacheDir();
    const outDir = await downloadAndExtractExtension({
      cacheDir,
      kind: "zip",
      name: "no-hash-extension",
      url,
    });

    expect(existsSync(path.join(outDir, "manifest.json"))).toBe(true);
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
