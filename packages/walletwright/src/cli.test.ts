import { mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import { isEntryPoint, parseFlags, resolveSetup } from "./cli";

const tempDirs: Array<string> = [];

afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { force: true, recursive: true });
  }
});

// Resolved through symlinks so the paths compare equal to a file URL: macOS `tmpdir()` is itself
// a symlink (/var to /private/var).
const makeTempDir = (): string => {
  const prefix = path.join(tmpdir(), "walletwright-cli-");
  const dir = realpathSync(mkdtempSync(prefix));
  tempDirs.push(dir);
  return dir;
};

describe("isEntryPoint", () => {
  it("recognises the entry when it is reached through a symlink", () => {
    const dir = makeTempDir();
    const real = path.join(dir, "cli.mjs");
    const link = path.join(dir, "link.mjs");
    writeFileSync(real, "");
    symlinkSync(real, link);

    expect(isEntryPoint(pathToFileURL(real).href, link)).toBe(true);
  });

  it("rejects an entry that is a different file", () => {
    const dir = makeTempDir();
    const real = path.join(dir, "cli.mjs");
    const other = path.join(dir, "other.mjs");
    writeFileSync(real, "");
    writeFileSync(other, "");

    expect(isEntryPoint(pathToFileURL(real).href, other)).toBe(false);
  });

  it("rejects a missing entry path", () => {
    expect(isEntryPoint(import.meta.url, undefined)).toBe(false);
  });
});

describe("parseFlags", () => {
  it("reads a flag's value from the following token", () => {
    expect(parseFlags(["--wallet", "metamask"])).toEqual({ wallet: "metamask" });
  });

  it("reads a help flag that leads the argv, where no command precedes it", () => {
    expect(parseFlags(["--help"])).toEqual({ help: true });
    expect(parseFlags(["-h"])).toEqual({ h: true });
  });

  it("skips a leading command token", () => {
    expect(parseFlags(["cache", "--wallet", "metamask"])).toEqual({ wallet: "metamask" });
  });

  it("coerces a value-less flag to boolean true", () => {
    expect(parseFlags(["--wallet", "metamask", "--seed", "--password", "pw"])).toEqual({
      password: "pw",
      seed: true,
      wallet: "metamask",
    });
  });
});

describe("resolveSetup", () => {
  it("rejects a value-less required flag instead of coercing it to a boolean", async () => {
    const flags = parseFlags(["--wallet", "metamask", "--seed", "--password", "pw"]);
    await expect(resolveSetup(flags)).rejects.toThrow(/--wallet\/--seed\/--password/v);
  });

  it("rejects an unknown --wallet and lists the valid kinds", async () => {
    const flags = parseFlags(["--wallet", "foo", "--seed", "a b c", "--password", "pw"]);
    await expect(resolveSetup(flags)).rejects.toThrow(
      /unknown --wallet "foo"\. Expected one of: metamask, phantom, rabby, slush, solflare\./v,
    );
  });

  it("builds a setup from --wallet/--seed/--password", async () => {
    const flags = parseFlags(["--wallet", "metamask", "--seed", "a b c", "--password", "pw"]);
    await expect(resolveSetup(flags)).resolves.toEqual({
      password: "pw",
      seedPhrase: "a b c",
      wallet: "metamask",
    });
  });

  it("applies --cache-dir on the --setup branch", async () => {
    const fixture = path.join(makeTempDir(), "setup.mjs");
    writeFileSync(
      fixture,
      'export default { password: "pw", seedPhrase: "a b c", wallet: "metamask" };\n',
    );

    const setup = await resolveSetup({ "cache-dir": "./ci-cache", setup: fixture });

    expect(setup.cacheDir).toBe("./ci-cache");
  });
});
