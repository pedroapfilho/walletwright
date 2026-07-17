import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";

import AdmZip from "adm-zip";
import { afterEach, describe, expect, it } from "vitest";

import { downloadAndExtractExtension } from "./download.ts";

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
});
