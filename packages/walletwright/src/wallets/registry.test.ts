import { describe, expect, it } from "vitest";

import type { WalletKind } from "../types.ts";

import { walletKindsByEcosystem, wallets } from "./index.ts";

describe("wallet registry", () => {
  it("maps ecosystems to the wallets that drive them", () => {
    expect(walletKindsByEcosystem("evm")).toEqual(expect.arrayContaining(["metamask", "phantom"]));
    expect(walletKindsByEcosystem("svm")).toContain("phantom");
    expect(walletKindsByEcosystem("sui")).toContain("slush");
  });

  it("returns an empty list for an ecosystem with no wallets yet", () => {
    expect(walletKindsByEcosystem("btc")).toEqual([]);
  });

  it("gives every registered wallet at least one ecosystem", () => {
    for (const kind of Object.keys(wallets) as Array<WalletKind>) {
      expect(wallets[kind].ecosystems.length).toBeGreaterThan(0);
    }
  });
});
