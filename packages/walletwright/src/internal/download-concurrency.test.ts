import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { createServer } from "node:http";
import { syncBuiltinESMExports } from "node:module";
import os from "node:os";
import path from "node:path";

import AdmZip from "adm-zip";
import { ClassicLevel } from "classic-level";
import { expect, it, vi } from "vitest";

import { downloadAndExtractExtension } from "./download";

it("rechecks the winner under ownership without deleting an extraction already in use", async () => {
  const actual = { stat: fs.stat };
  vi.spyOn(fs, "stat");
  syncBuiltinESMExports();
  const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), "walletwright-download-race-"));
  const outDir = path.join(cacheDir, "extension");
  const checked = Promise.withResolvers<undefined>();
  const resume = Promise.withResolvers<undefined>();
  const contended = Promise.withResolvers<undefined>();
  let checks = 0;
  let requests = 0;
  let second: Promise<string> | undefined;
  const zip = new AdmZip();
  zip.addFile("manifest.json", Buffer.from('{"name":"first"}'));
  const firstBytes = zip.toBuffer();
  zip.addFile("manifest.json", Buffer.from('{"name":"second"}'));
  const secondBytes = zip.toBuffer();

  const server = createServer((_request, response) => {
    requests += 1;
    response.end(requests === 1 ? firstBytes : secondBytes);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();

  if (address === null || typeof address === "string") {
    throw new Error("missing port");
  }

  const options = {
    cacheDir,
    format: "zip" as const,
    name: "extension",
    url: `http://127.0.0.1:${address.port}/ext.zip`,
  };

  vi.mocked(fs.stat).mockImplementation(async (...args: Parameters<typeof actual.stat>) => {
    if (args[0] === path.join(outDir, "manifest.json")) {
      checks += 1;

      if (checks === 2) {
        try {
          await actual.stat(args[0]);
          throw new Error("expected an unpublished extraction");
        } catch (error) {
          expect(error).toMatchObject({ code: "ENOENT" });
          checked.resolve(undefined);
          await resume.promise;
          throw error;
        }
      }
    }

    return actual.stat(...args);
  });
  const open = ClassicLevel.prototype.open;
  vi.spyOn(ClassicLevel.prototype, "open").mockImplementation(async function (this: ClassicLevel) {
    try {
      await open.call(this, {});
    } catch (error) {
      contended.resolve(undefined);
      throw error;
    }
  });

  const first = downloadAndExtractExtension({
    ...options,
    sha256: createHash("sha256").update(firstBytes).digest("hex"),
  });

  try {
    await checked.promise;
    second = downloadAndExtractExtension({
      ...options,
      sha256: createHash("sha256").update(secondBytes).digest("hex"),
    });
    expect(
      await Promise.race([
        contended.promise.then(() => "blocked"),
        second.then(() => "published without ownership"),
      ]),
    ).toBe("blocked");
    resume.resolve(undefined);
    expect(await first).toBe(outDir);
    const manifest = await fs.open(path.join(outDir, "manifest.json"), "r");
    const published = await manifest.stat();
    await fs.writeFile(path.join(outDir, "in-use"), "browser owns this extraction");

    try {
      expect(await second).toBe(outDir);
      const current = await actual.stat(path.join(outDir, "manifest.json"));
      expect(current.ino).toBe(published.ino);
      expect(await fs.readFile(path.join(outDir, "manifest.json"), "utf8")).toBe(
        '{"name":"first"}',
      );
      expect(await fs.readFile(path.join(outDir, "in-use"), "utf8")).toBe(
        "browser owns this extraction",
      );
      expect(await fs.readdir(cacheDir)).toEqual([".locks", "extension"]);
    } finally {
      await manifest.close();
    }
  } finally {
    resume.resolve(undefined);
    await Promise.allSettled([first, second]);
    vi.restoreAllMocks();
    syncBuiltinESMExports();
    server.closeAllConnections();
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
    await fs.rm(cacheDir, { force: true, recursive: true });
  }
});
