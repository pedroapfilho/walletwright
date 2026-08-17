import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { BrowserContext } from "@playwright/test";
import { afterEach, describe, expect, it } from "vitest";

import { closeLaunch } from "./launch";

const tempDirs: Array<string> = [];

afterEach(async () => {
  await Promise.allSettled(
    tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })),
  );
});

describe("closeLaunch", () => {
  it("removes the profile and surfaces a browser close failure", async () => {
    const runDir = await mkdtemp(path.join(os.tmpdir(), "walletwright-launch-test-"));
    tempDirs.push(runDir);
    await writeFile(path.join(runDir, "state"), "data");
    const context = {
      close: () => Promise.reject(new Error("close failed")),
    } as BrowserContext;

    await expect(closeLaunch(context, runDir)).rejects.toThrow("close failed");

    expect(existsSync(runDir)).toBe(false);
  });
});
