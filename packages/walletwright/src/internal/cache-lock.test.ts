import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { ClassicLevel } from "classic-level";
import { afterEach, describe, expect, it, vi } from "vitest";

import { withArtifactLock } from "./cache-lock";
import { copyProfile } from "./profile";

const directories: Array<string> = [];
const children: Array<ChildProcess> = [];

const artifactPath = async (): Promise<string> => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "walletwright-lock-test-"));
  directories.push(dir);
  return path.join(dir, "profile");
};

const worker = (artifact: string, movePrevious = false) => {
  const script = `
    import { withArtifactLock } from ${JSON.stringify(new URL("cache-lock.ts", import.meta.url).href)};
    import { ClassicLevel } from ${JSON.stringify(import.meta.resolve("classic-level"))};
    import { rename } from "node:fs/promises";
    const open = ClassicLevel.prototype.open;
    ClassicLevel.prototype.open = async function () {
      try { await open.call(this); }
      catch (error) { process.send('blocked'); throw error; }
    };
    await withArtifactLock(process.argv[1], async () => {
      if (process.argv[2] === 'move') await rename(process.argv[1], process.argv[1] + '.previous');
      process.send('entered');
      await new Promise(resolve => process.once('message', resolve));
    });
    process.disconnect();
  `;
  const child = spawn(
    process.execPath,
    ["--input-type=module", "--eval", script, artifact, movePrevious ? "move" : "hold"],
    {
      stdio: ["ignore", "ignore", "pipe", "ipc"],
    },
  );
  children.push(child);
  const entered = Promise.withResolvers<undefined>();
  const blocked = Promise.withResolvers<undefined>();
  let stderr = "";
  child.stderr?.on("data", (data: Buffer) => {
    stderr += data.toString();
  });
  child.on("message", (message) => {
    if (message === "entered") {
      entered.resolve(undefined);
    }
    if (message === "blocked") {
      blocked.resolve(undefined);
    }
  });
  const exited = (async () => {
    const [code, signal] = await once(child, "exit");
    return { code, signal, stderr };
  })();
  return { blocked: blocked.promise, child, entered: entered.promise, exited };
};

afterEach(async () => {
  vi.restoreAllMocks();
  for (const child of children.splice(0)) {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill("SIGKILL");
      await exited;
    }
  }
  await Promise.all(directories.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("cache ownership across processes", { timeout: 10_000 }, () => {
  it("excludes a second process, including through a symlinked cache path", async () => {
    const artifact = await artifactPath();
    const alias = `${path.dirname(artifact)}-alias`;
    directories.push(alias);
    await symlink(path.dirname(artifact), alias, "dir");
    const first = worker(artifact);
    await first.entered;
    const second = worker(path.join(alias, path.basename(artifact)));
    await second.blocked;
    first.child.send("release");
    expect(await first.exited).toMatchObject({ code: 0, stderr: "" });
    await second.entered;
    second.child.send("release");
    expect(await second.exited).toMatchObject({ code: 0, stderr: "" });
  });

  it("releases ownership when a holder is killed", async () => {
    const artifact = await artifactPath();
    const first = worker(artifact);
    await first.entered;
    const second = worker(artifact);
    await second.blocked;
    first.child.kill("SIGKILL");
    expect(await first.exited).toMatchObject({ signal: "SIGKILL" });
    await second.entered;
    second.child.send("release");
    expect(await second.exited).toMatchObject({ code: 0, stderr: "" });
  });

  it("recovers a complete old profile after a publisher dies between renames", async () => {
    const artifact = await artifactPath();
    await mkdir(artifact);
    await writeFile(path.join(artifact, "state"), "old");
    const publisher = worker(artifact, true);
    await publisher.entered;
    publisher.child.kill("SIGKILL");
    await publisher.exited;
    const copy = `${artifact}-copy`;
    await copyProfile(artifact, copy);
    expect(await readFile(path.join(copy, "state"), "utf8")).toBe("old");
    expect(await readFile(path.join(artifact, "state"), "utf8")).toBe("old");
  });

  it("reports a bounded wait and never steals ownership from a live holder", async () => {
    const artifact = await artifactPath();
    const holder = worker(artifact);
    await holder.entered;
    vi.spyOn(Date, "now").mockReturnValueOnce(0).mockReturnValue(60_001);
    await expect(withArtifactLock(artifact, () => Promise.resolve("stolen"))).rejects.toThrow(
      `timed out waiting for cache ownership at ${artifact}`,
    );
    holder.child.send("release");
    expect(await holder.exited).toMatchObject({ code: 0, stderr: "" });
  });

  it("propagates non-contention failures without retrying them", async () => {
    const artifact = await artifactPath();
    vi.spyOn(ClassicLevel.prototype, "open").mockRejectedValue(new Error("disk refused"));
    await expect(withArtifactLock(artifact, () => Promise.resolve())).rejects.toThrow(
      "disk refused",
    );
  });

  it("allows unrelated artifacts to proceed while one is held", async () => {
    const artifact = await artifactPath();
    await withArtifactLock(artifact, async () => {
      await expect(
        withArtifactLock(`${artifact}-other`, () => Promise.resolve("independent")),
      ).resolves.toBe("independent");
    });
  });

  it("releases ownership when the transaction throws", async () => {
    const artifact = await artifactPath();
    await expect(
      withArtifactLock(artifact, () => Promise.reject(new Error("failed"))),
    ).rejects.toThrow("failed");
    await expect(withArtifactLock(artifact, () => Promise.resolve("recovered"))).resolves.toBe(
      "recovered",
    );
  });
});
