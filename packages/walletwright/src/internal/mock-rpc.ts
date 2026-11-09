import type { PrivateKeyAccount } from "viem/accounts";
import { z } from "zod";

type Rpc = { method: string; params?: ReadonlyArray<unknown> };

type RpcResult = ReadonlyArray<string> | string | null;

/** MetaMask's own check: a 0x-prefixed hex chain id with no leading zeros. */
const chainParameterSchema = z.object({
  chainId: z.string().regex(/^0x[1-9a-f][\da-f]*$/iv),
});

const isHexMessage = (value: string): value is `0x${string}` => /^0x[\da-fA-F]*$/v.test(value);

type Method = (params: ReadonlyArray<unknown>) => Promise<RpcResult>;

const personalSign =
  (account: PrivateKeyAccount): Method =>
  (params) => {
    const message = params[0];

    return typeof message === "string"
      ? account.signMessage({ message: isHexMessage(message) ? { raw: message } : message })
      : Promise.reject(new Error("[walletwright/mock] personal_sign expects a string message"));
  };

/**
 * The EIP-1193 handler the EVM mock answers with, in Node. It holds the current chain, which a chain
 * switch or add replaces.
 */
const createRpcHandler = (account: PrivateKeyAccount, chainIdHex: string) => {
  let currentChainIdHex = chainIdHex;

  const accounts: Method = () => Promise.resolve([account.address]);

  const switchChain =
    (method: string): Method =>
    (params) => {
      const parsed = chainParameterSchema.safeParse(params[0]);

      if (!parsed.success) {
        return Promise.reject(
          new Error(
            `[walletwright/mock] ${method} expects params[0].chainId as a 0x-prefixed hex chain id`,
          ),
        );
      }

      currentChainIdHex = parsed.data.chainId.toLowerCase();

      return Promise.resolve(null);
    };

  const methods = new Map<string, Method>([
    ["eth_accounts", accounts],
    ["eth_chainId", () => Promise.resolve(currentChainIdHex)],
    ["eth_requestAccounts", accounts],
    ["personal_sign", personalSign(account)],
    ["wallet_addEthereumChain", switchChain("wallet_addEthereumChain")],
    ["wallet_switchEthereumChain", switchChain("wallet_switchEthereumChain")],
  ]);

  return ({ method, params = [] }: Rpc): Promise<RpcResult> => {
    const handle = methods.get(method);

    return handle === undefined
      ? Promise.reject(new Error(`[walletwright/mock] unsupported method: ${method}`))
      : handle(params);
  };
};

export { createRpcHandler };

export type { Rpc, RpcResult };
