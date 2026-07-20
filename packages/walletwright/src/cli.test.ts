import { describe, expect, it } from "vitest";

import { parseFlags } from "./cli.ts";

describe("parseFlags", () => {
  it("reads a --flag value pair", () => {
    expect(parseFlags(["--wallet", "metamask"])).toEqual({ wallet: "metamask" });
  });

  it("coerces a trailing value-less flag to true", () => {
    expect(parseFlags(["--headless"])).toEqual({ headless: true });
  });

  it("coerces a flag followed by another flag to true", () => {
    expect(parseFlags(["--seed", "--password", "pw"])).toEqual({ password: "pw", seed: true });
  });

  it("recognizes the -h short flag", () => {
    expect(parseFlags(["-h"])).toEqual({ h: true });
  });

  // --flag=value is NOT split; the whole token (minus the leading --) becomes the key.
  it("does not split --flag=value", () => {
    expect(parseFlags(["--wallet=metamask"])).toEqual({ "wallet=metamask": true });
  });
});
