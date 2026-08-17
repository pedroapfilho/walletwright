import { mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import { isEntryPoint, parseArgv, resolveSetup } from "./cli";

const tempDirs: Array<string> = [];

afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { force: true, recursive: true });
  }
});

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

const CREDENTIALS = ["--wallet", "metamask", "--seed", "a b c", "--password", "pw"];

describe("parseArgv", () => {
  it("prints help for no arguments, the help command, and either help flag", async () => {
    for (const argv of [[], ["help"], ["--help"], ["-h"]]) {
      await expect(parseArgv(argv)).resolves.toEqual({ kind: "help" });
    }
  });

  it("builds a cache command from --wallet/--seed/--password", async () => {
    await expect(parseArgv(["cache", ...CREDENTIALS])).resolves.toEqual({
      headless: false,
      kind: "cache",
      setup: { password: "pw", seedPhrase: "a b c", wallet: "metamask" },
    });
  });

  it("accepts the --flag=value spelling", async () => {
    await expect(
      parseArgv(["cache", "--wallet=metamask", "--seed=a b c", "--password=pw"]),
    ).resolves.toMatchObject({ setup: { wallet: "metamask" } });
  });

  it("rejects an unknown flag instead of ignoring it", async () => {
    await expect(parseArgv(["cache", ...CREDENTIALS, "--cache-dirr", "./ci"])).rejects.toThrow(
      /\[walletwright\].*cache-dirr/v,
    );
  });

  it("rejects a value handed to a boolean flag, which used to invert it", async () => {
    await expect(parseArgv(["cache", ...CREDENTIALS, "--headless", "false"])).rejects.toThrow(
      /unexpected argument "false"/v,
    );
  });

  it("reads --headless as a boolean", async () => {
    await expect(parseArgv(["cache", ...CREDENTIALS, "--headless"])).resolves.toMatchObject({
      headless: true,
    });
  });

  it("rejects a value-less required flag instead of coercing it to a boolean", async () => {
    await expect(
      parseArgv(["cache", "--wallet", "metamask", "--seed", "--password", "pw"]),
    ).rejects.toThrow(/\[walletwright\]/v);
  });

  it("rejects an unknown command", async () => {
    await expect(parseArgv(["bake", ...CREDENTIALS])).rejects.toThrow(/unknown command "bake"/v);
  });
});

describe("resolveSetup", () => {
  it("rejects an unknown --wallet and lists the valid kinds", async () => {
    await expect(resolveSetup({ password: "pw", seed: "a b c", wallet: "foo" })).rejects.toThrow(
      /unknown --wallet "foo"\. Expected one of: metamask, phantom, rabby, slush, solflare\./v,
    );
  });

  it("rejects a missing credential triple", async () => {
    await expect(resolveSetup({ wallet: "metamask" })).rejects.toThrow(
      /--wallet\/--seed\/--password/v,
    );
  });

  it("carries --version through onto the setup", async () => {
    await expect(
      resolveSetup({ password: "pw", seed: "a b c", version: "13.0.0", wallet: "metamask" }),
    ).resolves.toMatchObject({ version: "13.0.0" });
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

  it("refuses --setup combined with a flag it would silently discard", async () => {
    const fixture = path.join(makeTempDir(), "setup.mjs");
    writeFileSync(
      fixture,
      'export default { password: "pw", seedPhrase: "a b c", wallet: "metamask" };\n',
    );

    await expect(resolveSetup({ setup: fixture, version: "13.0.0" })).rejects.toThrow(
      /--setup carries the whole setup, so --version would be ignored/v,
    );
  });
});
