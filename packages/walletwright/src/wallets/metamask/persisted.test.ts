import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { Page } from "@playwright/test";
import { ClassicLevel } from "classic-level";
import { afterEach, describe, expect, it } from "vitest";

import { extensionStateDir } from "../../internal/profile";

import { isMetaMaskPersisted } from "./persisted";

const EXTENSION_ID = "nkbihfbeogaeaoehlefnkodbefgpgknn";
const VAULT = { vault: '{"data":"encrypted"}' };

const profileDirs: Array<string> = [];

const openState = async (profileDir: string): Promise<ClassicLevel> => {
  const db = new ClassicLevel(extensionStateDir(profileDir, EXTENSION_ID), {
    keyEncoding: "utf8",
    valueEncoding: "utf8",
  });
  await db.open();
  return db;
};

const seedProfile = async (state: Record<string, unknown>): Promise<string> => {
  const profileDir = await mkdtemp(path.join(os.tmpdir(), "walletwright-persisted-test-"));
  profileDirs.push(profileDir);
  await mkdir(extensionStateDir(profileDir, EXTENSION_ID), { recursive: true });
  const db = await openState(profileDir);
  for (const [key, value] of Object.entries(state)) {
    await db.put(key, JSON.stringify(value));
  }
  await db.close();
  return profileDir;
};

const persisted = (profileDir: string): Promise<boolean> =>
  isMetaMaskPersisted({ extensionId: EXTENSION_ID, page: {} as Page, profileDir });

afterEach(async () => {
  await Promise.allSettled(profileDirs.splice(0).map((dir) => rm(dir, { recursive: true })));
});

describe("isMetaMaskPersisted", () => {
  it("waits while the keyring state holds no vault, as MetaMask leaves it after its last screen", async () => {
    const profileDir = await seedProfile({ KeyringController: {} });

    expect(await persisted(profileDir)).toBe(false);
  });

  it("holds once the per-controller keyring state has its vault", async () => {
    const profileDir = await seedProfile({ KeyringController: VAULT });

    expect(await persisted(profileDir)).toBe(true);
  });

  it("holds once the single data key written by MetaMask 13.13.x has its vault", async () => {
    const profileDir = await seedProfile({ data: { data: { KeyringController: VAULT } } });

    expect(await persisted(profileDir)).toBe(true);
  });

  it("reads the state while the browser still holds the LevelDB lock", async () => {
    const profileDir = await seedProfile({ KeyringController: VAULT });
    const held = await openState(profileDir);

    try {
      expect(await persisted(profileDir)).toBe(true);
    } finally {
      await held.close();
    }
  });

  it("waits while the extension has written no state directory at all", async () => {
    const profileDir = await mkdtemp(path.join(os.tmpdir(), "walletwright-persisted-test-"));
    profileDirs.push(profileDir);

    expect(await persisted(profileDir)).toBe(false);
  });
});
