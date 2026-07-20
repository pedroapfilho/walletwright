import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { parseFlags, resolveSetup } from "./cli.ts";

const tempDirs: Array<string> = [];

afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { force: true, recursive: true });
  }
});

describe("parseFlags", () => {
  it("reads a flag's value from the following token", () => {
    expect(parseFlags(["--wallet", "metamask"])).toEqual({ wallet: "metamask" });
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
      /unknown --wallet "foo"\. Expected one of: metamask, phantom, slush\./v,
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
    const dir = mkdtempSync(path.join(tmpdir(), "walletwright-cli-"));
    tempDirs.push(dir);
    const fixture = path.join(dir, "setup.mjs");
    writeFileSync(
      fixture,
      'export default { password: "pw", seedPhrase: "a b c", wallet: "metamask" };\n',
    );

    const setup = await resolveSetup({ "cache-dir": "./ci-cache", setup: fixture });

    expect(setup.cacheDir).toBe("./ci-cache");
  });
});
