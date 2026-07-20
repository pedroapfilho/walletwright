import { createPublicKey, verify } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createStandardHandler, encodeBase58, privateKeyFromSeed } from "./mock-standard.ts";

const SEED_HEX = "0101010101010101010101010101010101010101010101010101010101010101";

describe("encodeBase58", () => {
  it("encodes a single-byte vector deterministically", () => {
    expect(encodeBase58(Uint8Array.from([0x61]))).toBe("2g");
  });

  it("encodes a multi-byte vector deterministically", () => {
    expect(encodeBase58(Uint8Array.from([0x62, 0x62, 0x62]))).toBe("a3gV");
  });

  it("preserves leading zero bytes as leading ones", () => {
    expect(encodeBase58(Uint8Array.from([0x00, 0x00, 0x01]))).toBe("112");
  });
});

describe("createStandardHandler", () => {
  const seed = Buffer.from(SEED_HEX, "hex");
  const handle = createStandardHandler(seed);

  it("signs solana:signMessage with a real ed25519 key that verifies against the public key", async () => {
    const message = [...Buffer.from("gm walletwright")];
    const signature = await handle({ message, method: "solana:signMessage" });

    const publicKey = createPublicKey(privateKeyFromSeed(seed));
    const accepted = verify(null, Uint8Array.from(message), publicKey, Uint8Array.from(signature));
    expect(accepted).toBe(true);
  });

  it("answers solana:signMessage with a 64-byte signature array", async () => {
    const signature = await handle({ message: [1, 2, 3], method: "solana:signMessage" });
    expect(signature).toHaveLength(64);
  });

  it("rejects an unsupported method", async () => {
    await expect(handle({ method: "solana:signTransaction" })).rejects.toThrow(
      /unsupported method/v,
    );
  });
});
