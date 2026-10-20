import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import os from "node:os";
import path from "node:path";

import { ClassicLevel } from "classic-level";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { copyProfile, publishProfile } from "./profile";

const actual = { cp: fs.cp, rename: fs.rename };

beforeEach(() => {
  vi.spyOn(fs, "cp");
  vi.spyOn(fs, "rename");
  syncBuiltinESMExports();
});
const directories: Array<string> = [];

const fixture = async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "walletwright-profile-race-"));
  directories.push(root);
  const profile = path.join(root, "profile");
  const staging = path.join(root, "staging");
  const copy = path.join(root, "copy");
  for (const [dir, state] of [
    [profile, "old"],
    [staging, "new"],
  ] as const) {
    await fs.mkdir(dir);
    await fs.writeFile(path.join(dir, "first"), state);
    await fs.writeFile(path.join(dir, "second"), state);
  }
  return { copy, profile, root, staging };
};

const snapshot = (dir: string) =>
  Promise.all([
    fs.readFile(path.join(dir, "first"), "utf8"),
    fs.readFile(path.join(dir, "second"), "utf8"),
  ]);

const nextContention = (): Promise<void> => {
  const waiting = Promise.withResolvers<undefined>();
  const open = ClassicLevel.prototype.open;
  vi.spyOn(ClassicLevel.prototype, "open").mockImplementation(async function (this: ClassicLevel) {
    try {
      await open.call(this, {});
    } catch (error) {
      waiting.resolve(undefined);
      throw error;
    }
  });
  return waiting.promise;
};

afterEach(async () => {
  vi.restoreAllMocks();
  syncBuiltinESMExports();
  await Promise.all(
    directories.splice(0).map((dir) => fs.rm(dir, { force: true, recursive: true })),
  );
});

describe("profile transactions", () => {
  it("does not recover an active publisher's backup while selecting a copy", async () => {
    const { copy, profile, staging } = await fixture();
    const moved = Promise.withResolvers<undefined>();
    const resume = Promise.withResolvers<undefined>();
    vi.mocked(fs.rename).mockImplementationOnce(async (from, to) => {
      await actual.rename(from, to);
      moved.resolve(undefined);
      await resume.promise;
    });
    const publishing = publishProfile(staging, profile);
    await moved.promise;
    const waiting = nextContention();
    const copying = copyProfile(profile, copy);
    try {
      await waiting;
      expect(await snapshot(`${profile}.previous`)).toEqual(["old", "old"]);
    } finally {
      resume.resolve(undefined);
      await Promise.all([publishing, copying]);
    }
    expect(await snapshot(copy)).toEqual(["new", "new"]);
  });

  it("keeps the selected generation in place until every file is copied", async () => {
    const { copy, profile, staging } = await fixture();
    const started = Promise.withResolvers<undefined>();
    const resume = Promise.withResolvers<undefined>();
    vi.mocked(fs.cp).mockImplementationOnce(async (from, to) => {
      await fs.mkdir(to, { recursive: true });
      await fs.copyFile(path.join(String(from), "first"), path.join(String(to), "first"));
      started.resolve(undefined);
      await resume.promise;
      await fs.copyFile(path.join(String(from), "second"), path.join(String(to), "second"));
    });
    const copying = copyProfile(profile, copy);
    await started.promise;
    const waiting = nextContention();
    const publishing = publishProfile(staging, profile);
    try {
      await waiting;
      expect(await snapshot(profile)).toEqual(["old", "old"]);
    } finally {
      resume.resolve(undefined);
      await Promise.all([copying, publishing]);
    }
    expect(await snapshot(copy)).toEqual(["old", "old"]);
    expect(await snapshot(profile)).toEqual(["new", "new"]);
  });

  it("serializes two publishers without either consuming the other's backup", async () => {
    const { profile, root, staging } = await fixture();
    const second = path.join(root, "second-staging");
    await actual.cp(staging, second, { recursive: true });
    await fs.writeFile(path.join(second, "first"), "second");
    await fs.writeFile(path.join(second, "second"), "second");
    const moved = Promise.withResolvers<undefined>();
    const resume = Promise.withResolvers<undefined>();
    vi.mocked(fs.rename).mockImplementationOnce(async (from, to) => {
      await actual.rename(from, to);
      moved.resolve(undefined);
      await resume.promise;
    });
    const first = publishProfile(staging, profile);
    await moved.promise;
    const waiting = nextContention();
    const next = publishProfile(second, profile);
    try {
      await waiting;
      expect(await snapshot(`${profile}.previous`)).toEqual(["old", "old"]);
    } finally {
      resume.resolve(undefined);
      await Promise.all([first, next]);
    }
    expect(await snapshot(profile)).toEqual(["second", "second"]);
    expect(await fs.readdir(root)).toEqual([".locks", "profile"]);
  });

  it("releases ownership and recovers the backup after publish and rollback both fail", async () => {
    const { copy, profile, staging } = await fixture();
    vi.mocked(fs.rename)
      .mockImplementationOnce(actual.rename)
      .mockRejectedValueOnce(new Error("publish refused"))
      .mockRejectedValueOnce(new Error("rollback refused"));
    await expect(publishProfile(staging, profile)).rejects.toThrow(
      /publish refused; rollback failed: rollback refused/v,
    );
    expect(await snapshot(`${profile}.previous`)).toEqual(["old", "old"]);
    await copyProfile(profile, copy);
    expect(await snapshot(copy)).toEqual(["old", "old"]);
    await publishProfile(staging, profile);
    expect(await snapshot(profile)).toEqual(["new", "new"]);
  });

  it("releases ownership after a copy fails so a rebuild can still publish", async () => {
    const { copy, profile, staging } = await fixture();
    vi.mocked(fs.cp).mockRejectedValueOnce(new Error("copy refused"));
    await expect(copyProfile(profile, copy)).rejects.toThrow("copy refused");
    await publishProfile(staging, profile);
    expect(await snapshot(profile)).toEqual(["new", "new"]);
  });

  it("keeps a committed new profile when recovering a leftover backup", async () => {
    const { copy, profile, staging } = await fixture();
    await actual.rename(profile, `${profile}.previous`);
    await actual.rename(staging, profile);
    await copyProfile(profile, copy);
    expect(await snapshot(copy)).toEqual(["new", "new"]);
    await expect(fs.stat(`${profile}.previous`)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
