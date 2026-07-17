import { verifyMessage } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";

import { createRpcHandler } from "./mock.ts";

// Anvil/Hardhat account #0, address 0xf39F…92266. Public, well-known test key.
const DEFAULT_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

describe("createRpcHandler", () => {
  const account = privateKeyToAccount(DEFAULT_KEY);
  const handle = createRpcHandler(account, "0x7a69");

  it("resolves eth_accounts and eth_requestAccounts to the account address", async () => {
    await expect(handle({ method: "eth_accounts" })).resolves.toEqual([account.address]);
    await expect(handle({ method: "eth_requestAccounts" })).resolves.toEqual([account.address]);
  });

  it("resolves eth_chainId to the exact hex passed in", async () => {
    await expect(handle({ method: "eth_chainId" })).resolves.toBe("0x7a69");
  });

  it("signs a UTF-8 personal_sign message that verifies against the account", async () => {
    const signature = (await handle({
      method: "personal_sign",
      params: ["hello", account.address],
    })) as `0x${string}`;

    await expect(
      verifyMessage({ address: account.address, message: "hello", signature }),
    ).resolves.toBe(true);
  });

  it("signs a raw-hex personal_sign message that verifies and matches the UTF-8 signature", async () => {
    const hexMessage = "0x68656c6c6f"; // "hello"
    const hexSignature = (await handle({
      method: "personal_sign",
      params: [hexMessage, account.address],
    })) as `0x${string}`;

    await expect(
      verifyMessage({
        address: account.address,
        message: { raw: hexMessage },
        signature: hexSignature,
      }),
    ).resolves.toBe(true);

    const utf8Signature = (await handle({
      method: "personal_sign",
      params: ["hello", account.address],
    })) as `0x${string}`;
    expect(hexSignature).toBe(utf8Signature);
  });

  it("resolves wallet_addEthereumChain to null", async () => {
    await expect(handle({ method: "wallet_addEthereumChain" })).resolves.toBeNull();
  });

  it("rejects an unsupported method", async () => {
    await expect(handle({ method: "eth_getBalance" })).rejects.toThrow(/unsupported method/v);
  });
});
