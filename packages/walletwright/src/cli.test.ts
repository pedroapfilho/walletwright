import { mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import { isEntryPoint, parseArgv, resolveSetups } from "./cli";

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
  it("recognises the entry when it is reached through a symlink", async () => {
    const dir = makeTempDir();
    const real = path.join(dir, "cli.mjs");
    const link = path.join(dir, "link.mjs");
    writeFileSync(real, "");
    symlinkSync(real, link);

    await expect(isEntryPoint(pathToFileURL(real).href, link)).resolves.toBe(true);
  });

  it("rejects an entry that is a different file", async () => {
    const dir = makeTempDir();
    const real = path.join(dir, "cli.mjs");
    const other = path.join(dir, "other.mjs");
    writeFileSync(real, "");
    writeFileSync(other, "");

    await expect(isEntryPoint(pathToFileURL(real).href, other)).resolves.toBe(false);
  });

  it("rejects a missing entry path", async () => {
    await expect(isEntryPoint(import.meta.url, undefined)).resolves.toBe(false);
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
      setups: [{ password: "pw", seedPhrase: "a b c", wallet: "metamask" }],
    });
  });

  it("accepts the --flag=value spelling", async () => {
    await expect(
      parseArgv(["cache", "--wallet=metamask", "--seed=a b c", "--password=pw"]),
    ).resolves.toMatchObject({ setups: [{ wallet: "metamask" }] });
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

const writeSetupModule = (source: string): string => {
  const file = path.join(makeTempDir(), "setup.mjs");
  writeFileSync(file, source);
  return file;
};

const NAMED_SETUPS = `
export const metamask = { password: "pw", seedPhrase: "a b c", wallet: "metamask" };
export const phantom = { password: "pw", seedPhrase: "d e f", wallet: "phantom" };
export const walletSetups = { metamask, phantom };
export const helper = () => metamask;
export default metamask;
`;

describe("resolveSetups", () => {
  it("rejects an unknown --wallet and lists the valid kinds", async () => {
    await expect(resolveSetups({ password: "pw", seed: "a b c", wallet: "foo" })).rejects.toThrow(
      /unknown --wallet "foo"\. Expected one of: metamask, phantom, rabby, slush, solflare\./v,
    );
  });

  it("rejects a missing credential triple", async () => {
    await expect(resolveSetups({ wallet: "metamask" })).rejects.toThrow(
      /--wallet\/--seed\/--password/v,
    );
  });

  it("carries --version through onto the setup", async () => {
    await expect(
      resolveSetups({ password: "pw", seed: "a b c", version: "13.0.0", wallet: "metamask" }),
    ).resolves.toMatchObject([{ version: "13.0.0" }]);
  });

  it("builds every setup a module exports, once each, skipping its other exports", async () => {
    const setups = await resolveSetups({ setup: writeSetupModule(NAMED_SETUPS) });

    expect(setups.map((setup) => setup.wallet)).toEqual(["metamask", "phantom"]);
  });

  it("narrows a --setup module to the wallet --wallet names", async () => {
    const setups = await resolveSetups({
      setup: writeSetupModule(NAMED_SETUPS),
      wallet: "phantom",
    });

    expect(setups).toEqual([{ password: "pw", seedPhrase: "d e f", wallet: "phantom" }]);
  });

  it("refuses a --wallet the --setup module has no setup for", async () => {
    await expect(
      resolveSetups({ setup: writeSetupModule(NAMED_SETUPS), wallet: "slush" }),
    ).rejects.toThrow(/exports no slush WalletSetup/v);
  });

  it("names a setup-shaped export that fails validation instead of skipping it", async () => {
    const file = writeSetupModule('export const broken = { password: "pw", wallet: "metamsk" };\n');

    await expect(resolveSetups({ setup: file })).rejects.toThrow(
      /export "broken" is not a valid WalletSetup/v,
    );
  });

  it("refuses a module that exports no setup at all", async () => {
    await expect(
      resolveSetups({ setup: writeSetupModule("export const n = 1;\n") }),
    ).rejects.toThrow(/exports no WalletSetup/v);
  });

  it("applies --cache-dir on the --setup branch", async () => {
    const [setup] = await resolveSetups({
      "cache-dir": "./ci-cache",
      setup: writeSetupModule(NAMED_SETUPS),
    });

    expect(setup?.cacheDir).toBe("./ci-cache");
  });

  it("refuses --setup combined with a flag it would silently discard", async () => {
    await expect(
      resolveSetups({ setup: writeSetupModule(NAMED_SETUPS), version: "13.0.0" }),
    ).rejects.toThrow(/--setup carries the credentials, so --version would be ignored/v);
  });
});
