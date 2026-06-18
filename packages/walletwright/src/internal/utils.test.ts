import { describe, expect, it } from "vitest";

import type { WalletSetup } from "../types.ts";

import { profileKey } from "./utils.ts";

describe("profileKey", () => {
  const base: WalletSetup = {
    password: "pw",
    seedPhrase: "alpha bravo charlie",
    wallet: "metamask",
  };

  it("is deterministic for the same setup", () => {
    expect(profileKey(base)).toBe(profileKey({ ...base }));
  });

  it("differs when any input differs", () => {
    expect(profileKey(base)).not.toBe(profileKey({ ...base, password: "other" }));
    expect(profileKey(base)).not.toBe(profileKey({ ...base, seedPhrase: "x y z" }));
    expect(profileKey(base)).not.toBe(profileKey({ ...base, wallet: "phantom" }));
    expect(profileKey(base)).not.toBe(profileKey({ ...base, version: "1.2.3" }));
  });

  it("is a 20-char hex string", () => {
    expect(profileKey(base)).toMatch(/^[0-9a-f]{20}$/v);
  });
});
