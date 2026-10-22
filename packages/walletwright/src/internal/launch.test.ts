import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, it } from "vitest";

import type { WalletDefinition } from "../types";

import { build } from "./cache";
import { runDirectly } from "./controller";
import { pathExists } from "./fs";
import { launch } from "./launch";
import type { EngineSetup } from "./profile";
import { type Standin, serveStandin, userDataDirOf } from "./standin";

let standin: Standin;
let setup: EngineSetup;
let profileDir: string;

beforeAll(async () => {
  standin = await serveStandin();
  const cacheDir = await mkdtemp(path.join(os.tmpdir(), "walletwright-launch-test-"));
  setup = {
    cacheDir,
    password: "stand-in-password",
    seedPhrase: "stand in seed",
    wallet: "standin",
  };
  profileDir = await build(standin.definition, setup, { headless: true });
}, 60_000);

afterAll(async () => {
  await standin.close();

  if (setup.cacheDir !== undefined) {
    await rm(setup.cacheDir, { force: true, recursive: true });
  }
});

const launchHeadless = (definition: WalletDefinition, launchSetup = setup) =>
  launch(definition, launchSetup, { headless: true, step: runDirectly });

/** The stand-in, reporting the profile directory each launch runs on through `onProfile`. */
const reportingProfile = (
  onProfile: (userDataDir: string) => void,
  prepared: () => Promise<void> = () => Promise.resolve(),
): WalletDefinition => ({
  ...standin.definition,
  prepareContext: async (context) => {
    onProfile(await userDataDirOf(context));
    await prepared();
  },
});

describe.concurrent("launch", { timeout: 60_000 }, () => {
  it("refuses a setup that has no cache", async ({ expect }) => {
    await expect(
      launchHeadless(standin.definition, { ...setup, seedPhrase: "never built" }),
    ).rejects.toThrow("no cache for this setup");
  });

  it("requires a new cache after the default release changes", async ({ expect }) => {
    const definition = standin.definition;

    if (definition.source.kind !== "release") {
      throw new Error("expected a release source");
    }

    await expect(
      launchHeadless({
        ...definition,
        source: { ...definition.source, defaultVersion: "2.0.0" },
      }),
    ).rejects.toThrow("no cache for this setup");
    await using launched = await launchHeadless(definition, { ...setup, version: "1.0.0" });
    expect(await launched.wallet.home.getByText("Unlocked", { exact: true }).isVisible()).toBe(
      true,
    );
  });

  it("refuses headless for a wallet without verified headless approvals", async ({ expect }) => {
    await expect(
      launchHeadless({
        ...standin.definition,
        approval: { ...standin.definition.approval, headless: false },
      }),
    ).rejects.toThrow(
      "[walletwright] Stand-in has no verified headless approval flow; run this suite headed",
    );
  });

  it("unlocks a copy of the cached profile and removes the copy on close", async ({ expect }) => {
    let copy = "";

    const launched = await launchHeadless(
      reportingProfile((userDataDir) => {
        copy = userDataDir;
      }),
    );

    expect(await pathExists(copy)).toBe(true);
    expect(path.basename(copy)).not.toBe(path.basename(profileDir));
    expect(await launched.wallet.home.getByText("Unlocked", { exact: true }).isVisible()).toBe(
      true,
    );

    await launched.close();
    expect(await pathExists(copy)).toBe(false);
    expect(await pathExists(profileDir)).toBe(true);
  });

  it("closes the browser and removes the copy when the launch fails", async ({ expect }) => {
    let copy = "";
    await expect(
      launchHeadless(
        reportingProfile(
          (userDataDir) => {
            copy = userDataDir;
          },
          () => Promise.reject(new Error("route failed")),
        ),
      ),
    ).rejects.toThrow("route failed");

    expect(copy).not.toBe("");
    expect(await pathExists(copy)).toBe(false);
  });

  it("reloads an unlock screen that only settles after a reload", async ({ expect }) => {
    await using launched = await launchHeadless({
      ...standin.definition,
      unlockScreen: { ...standin.definition.unlockScreen, entry: "home.html?settle=reload" },
    });

    expect(await launched.wallet.home.getByText("Unlocked", { exact: true }).isVisible()).toBe(
      true,
    );
  });
});
