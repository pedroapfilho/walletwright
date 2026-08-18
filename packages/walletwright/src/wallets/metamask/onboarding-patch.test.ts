import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { ClassicLevel } from "classic-level";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { extensionStateDir } from "../../internal/utils";

import { markMetaMaskOnboarded } from "./onboarding-patch";

const EXTENSION_ID = "nkbihfbeogaeaoehlefnkodbefgpgknn";
const jsonSchema = z.json();

type JsonValue = z.infer<typeof jsonSchema>;

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
  const profileDir = await mkdtemp(path.join(os.tmpdir(), "walletwright-onboarding-test-"));
  profileDirs.push(profileDir);
  await mkdir(extensionStateDir(profileDir, EXTENSION_ID), { recursive: true });
  const db = await openState(profileDir);
  for (const [key, value] of Object.entries(state)) {
    await db.put(key, JSON.stringify(value));
  }
  await db.close();
  return profileDir;
};

const readState = async (profileDir: string, key: string): Promise<JsonValue | undefined> => {
  const db = await openState(profileDir);
  const raw = await db.get(key);
  await db.close();
  return raw === undefined ? undefined : jsonSchema.parse(JSON.parse(raw));
};

afterEach(async () => {
  await Promise.allSettled(profileDirs.splice(0).map((dir) => rm(dir, { recursive: true })));
});

describe("markMetaMaskOnboarded", () => {
  it("patches the per-controller key written by MetaMask 13.3x", async () => {
    const profileDir = await seedProfile({
      OnboardingController: { completedOnboarding: false, firstTimeFlowType: "create" },
    });

    await markMetaMaskOnboarded(profileDir, EXTENSION_ID);

    expect(await readState(profileDir, "OnboardingController")).toMatchObject({
      completedOnboarding: true,
      firstTimeFlowType: "create",
    });
  });

  it("patches the single data key written by MetaMask 13.13.x", async () => {
    const profileDir = await seedProfile({
      data: { data: { OnboardingController: { completedOnboarding: false } } },
    });

    await markMetaMaskOnboarded(profileDir, EXTENSION_ID);

    expect(await readState(profileDir, "data")).toMatchObject({
      data: { OnboardingController: { completedOnboarding: true, firstTimeFlowType: "import" } },
    });
  });

  it("throws when neither state shape is present", async () => {
    const profileDir = await seedProfile({ SomeOtherController: {} });

    await expect(markMetaMaskOnboarded(profileDir, EXTENSION_ID)).rejects.toThrow(
      /persisted no onboarding state/v,
    );
  });

  it("throws when the extension wrote no state directory at all", async () => {
    const profileDir = await mkdtemp(path.join(os.tmpdir(), "walletwright-onboarding-test-"));
    profileDirs.push(profileDir);

    await expect(markMetaMaskOnboarded(profileDir, EXTENSION_ID)).rejects.toThrow(
      /wrote no extension state/v,
    );
  });
});
