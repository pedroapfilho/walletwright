import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, it } from "vitest";

import { build } from "./cache";
import { pathExists } from "./fs";
import type { EngineSetup } from "./profile";
import { type Standin, serveStandin, userDataDirOf } from "./standin";

const EXTENSION_DIR = "standin-1.0.0";

let standin: Standin;
const tempDirs: Array<string> = [];

beforeAll(async () => {
  standin = await serveStandin();
});

afterAll(async () => {
  await standin.close();
  await Promise.allSettled(
    tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })),
  );
});

const makeSetup = async (): Promise<EngineSetup & { cacheDir: string }> => {
  const cacheDir = await mkdtemp(path.join(os.tmpdir(), "walletwright-cache-test-"));
  tempDirs.push(cacheDir);
  return {
    cacheDir,
    password: "stand-in-password",
    seedPhrase: "stand in seed",
    wallet: "standin",
  };
};

const listCache = async (cacheDir: string): Promise<Array<string>> => {
  const entries = await readdir(cacheDir);
  return entries.toSorted();
};

describe.concurrent("build", { timeout: 60_000 }, () => {
  it("publishes the onboarded profile beside the extension, with no staging left", async ({
    expect,
  }) => {
    const setup = await makeSetup();

    const profileDir = await build(standin.definition, setup, { headless: true });

    expect(await listCache(setup.cacheDir)).toEqual(
      [path.basename(profileDir), EXTENSION_DIR].toSorted(),
    );
  });

  it("keeps the previous profile in place until the rebuild publishes", async ({ expect }) => {
    const setup = await makeSetup();
    const profileDir = await build(standin.definition, setup, { headless: true });
    const marker = path.join(profileDir, "previous-build");
    await writeFile(marker, "");

    let keptUntilPublish = false;
    await build(
      {
        ...standin.definition,
        finalizeCache: async () => {
          keptUntilPublish = await pathExists(marker);
        },
      },
      setup,
      { headless: true },
    );

    expect(keptUntilPublish).toBe(true);
    expect(await pathExists(marker)).toBe(false);
    expect(await listCache(setup.cacheDir)).toEqual(
      [path.basename(profileDir), EXTENSION_DIR].toSorted(),
    );
  });

  it("leaves the previous profile in place when a rebuild fails", async ({ expect }) => {
    const setup = await makeSetup();
    const profileDir = await build(standin.definition, setup, { headless: true });
    const marker = path.join(profileDir, "previous-build");
    await writeFile(marker, "");

    await expect(
      build(
        { ...standin.definition, importWallet: () => Promise.reject(new Error("import failed")) },
        setup,
        { headless: true },
      ),
    ).rejects.toThrow("import failed");

    expect(await pathExists(marker)).toBe(true);
    expect(await listCache(setup.cacheDir)).toEqual(
      [path.basename(profileDir), EXTENSION_DIR].toSorted(),
    );
  });

  it("closes the browser and removes staging when the wallet's prepareContext fails", async ({
    expect,
  }) => {
    const setup = await makeSetup();
    let staging = "";
    let closed = false;

    await expect(
      build(
        {
          ...standin.definition,
          prepareContext: async (context) => {
            context.on("close", () => {
              closed = true;
            });
            staging = await userDataDirOf(context);
            throw new Error("route failed");
          },
        },
        setup,
        { headless: true },
      ),
    ).rejects.toThrow("route failed");

    expect(closed).toBe(true);
    expect(await pathExists(staging)).toBe(false);
    expect(await listCache(setup.cacheDir)).toEqual([EXTENSION_DIR]);
  });
});
