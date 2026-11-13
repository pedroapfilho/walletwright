import { describe, expect, it } from "vitest";

import type { WalletKind } from "../types";

import { wallets } from "./index";

describe("wallet registry", () => {
  it("gives every registered wallet at least one ecosystem", () => {
    for (const kind of Object.keys(wallets) as Array<WalletKind>) {
      expect(wallets[kind].ecosystems.length).toBeGreaterThan(0);
    }
  });
});
