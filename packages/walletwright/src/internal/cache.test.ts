import { mkdtemp, readdir, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, it } from "vitest";

import { build } from "./cache";
import { runDirectly } from "./controller";
import { pathExists } from "./fs";
import { launch } from "./launch";
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
      [".locks", path.basename(profileDir), EXTENSION_DIR].toSorted(),
    );
  });

  it("waits for a wallet that writes its state long after its last screen", async ({ expect }) => {
    const setup = await makeSetup();

    await build({ ...standin.definition, onboardingPage: "onboarding.html?persist=late" }, setup, {
      headless: true,
    });

    const launched = await launch(standin.definition, setup, { headless: true, step: runDirectly });

    try {
      expect(await launched.wallet.home.getByText("Unlocked", { exact: true }).isVisible()).toBe(
        true,
      );
    } finally {
      await launched.close();
    }
  });

  it("polls the wallet's own check on the onboarding page until it holds, then finalizes", async ({
    expect,
  }) => {
    const setup = await makeSetup();
    let staging = "";
    const checked: Array<{ page: string; profileDir: string }> = [];
    let checksBeforeFinalize = 0;

    await build(
      {
        ...standin.definition,
        finalizeCache: () => {
          checksBeforeFinalize = checked.length;

          return Promise.resolve();
        },
        isPersisted: async ({ page, profileDir }) => {
          checked.push({
            page: new URL(page.url()).pathname,
            profileDir: await realpath(profileDir),
          });

          return checked.length === 3;
        },
        prepareContext: async (context) => {
          staging = await userDataDirOf(context);
        },
      },
      setup,
      { headless: true },
    );

    expect(checksBeforeFinalize).toBe(3);
    expect(checked).toEqual(
      Array.from({ length: 3 }, () => ({ page: "/onboarding.html", profileDir: staging })),
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
      [".locks", path.basename(profileDir), EXTENSION_DIR].toSorted(),
    );
  });

  it("launches from the old snapshot while a rebuild finalizes, then keeps that copy usable", async ({
    expect,
  }) => {
    const setup = await makeSetup();
    const profile = await build(standin.definition, setup, { headless: true });
    await writeFile(path.join(profile, "old-generation"), "old");
    const finalizing = Promise.withResolvers<undefined>();
    const resume = Promise.withResolvers<undefined>();

    const rebuild = build(
      {
        ...standin.definition,
        finalizeCache: async () => {
          finalizing.resolve(undefined);
          await resume.promise;
        },
      },
      setup,
      { headless: true },
    );

    await finalizing.promise;

    try {
      await using launched = await launch(standin.definition, setup, {
        headless: true,
        step: runDirectly,
      });

      const copy = await userDataDirOf(launched.context);
      expect(await pathExists(path.join(copy, "old-generation"))).toBe(true);
      resume.resolve(undefined);
      await rebuild;
      expect(await pathExists(path.join(profile, "old-generation"))).toBe(false);
      const request = await standin.request(launched.context, "ready");
      await launched.wallet.approve();
      expect(await request.answer()).toBe("approved");
    } finally {
      resume.resolve(undefined);
      await rebuild;
    }
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
      [".locks", path.basename(profileDir), EXTENSION_DIR].toSorted(),
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
    expect(await listCache(setup.cacheDir)).toEqual([".locks", EXTENSION_DIR]);
  });
});
