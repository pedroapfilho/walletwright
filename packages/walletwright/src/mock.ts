import type { BrowserContext, Page } from "@playwright/test";
import type { PrivateKeyAccount } from "viem/accounts";
import { privateKeyToAccount } from "viem/accounts";

import type { BridgeCall } from "./internal/page-bridge";
import { installPageBridge } from "./internal/page-bridge";

/** Headless EIP-6963 and EIP-1193 mock that signs with a real key. */
type MockWalletOptions = {
  chainId?: number;
  /** Wallet name announced over EIP-6963. */
  name?: string;
  /** The account's private key. Defaults to anvil/hardhat account #0. */
  privateKey?: `0x${string}`;
};

const DEFAULT_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

type Rpc = { method: string; params?: ReadonlyArray<unknown> };
type RpcResult = ReadonlyArray<string> | string | null;
type Eip6963Info = { icon: string; name: string; rdns: string };

const toHex = (value: number): `0x${string}` => `0x${value.toString(16)}`;

const isHexMessage = (value: string): value is `0x${string}` => /^0x[\da-fA-F]*$/v.test(value);

/** The EIP-1193 handler a mock provider answers with. Exported for direct, browser-free testing. */
const createRpcHandler =
  (account: PrivateKeyAccount, chainIdHex: string) =>
  ({ method, params = [] }: Rpc): Promise<RpcResult> => {
    switch (method) {
      case "eth_requestAccounts":
      case "eth_accounts": {
        return Promise.resolve([account.address]);
      }
      case "eth_chainId": {
        return Promise.resolve(chainIdHex);
      }
      case "personal_sign": {
        const [message] = params;
        if (typeof message !== "string") {
          return Promise.reject(
            new Error("[walletwright/mock] personal_sign expects a string message"),
          );
        }
        return account.signMessage({
          message: isHexMessage(message) ? { raw: message } : message,
        });
      }
      case "wallet_switchEthereumChain":
      case "wallet_addEthereumChain": {
        return Promise.resolve(null);
      }
      default: {
        return Promise.reject(new Error(`[walletwright/mock] unsupported method: ${method}`));
      }
    }
  };

const mountEip1193Provider = (
  call: BridgeCall<Rpc, RpcResult>,
  info: Eip6963Info,
  uuid: string,
) => {
  const provider = {
    isMetaMask: true,
    on: () => provider,
    removeListener: () => provider,
    request: (rpc: Rpc) => call(rpc),
  };
  // SAFETY: EIP-1193 providers own window.ethereum, which the DOM library does not declare.
  (window as Window & { ethereum?: typeof provider }).ethereum = provider;

  const announce = () => {
    window.dispatchEvent(
      new CustomEvent("eip6963:announceProvider", {
        detail: Object.freeze({ info: { ...info, uuid }, provider }),
      }),
    );
  };
  window.addEventListener("eip6963:requestProvider", announce);
  announce();
};

/**
 * Install the mock on a context (every page) or a single page. Call before `goto`, so the provider
 * exists when the dapp looks for it. Returns the account address it announces.
 */
const installMockWallet = async (
  target: BrowserContext | Page,
  options: MockWalletOptions = {},
): Promise<string> => {
  const { chainId = 31_337, name = "Walletwright Mock", privateKey = DEFAULT_KEY } = options;
  const account = privateKeyToAccount(privateKey);
  await installPageBridge(target, {
    data: {
      icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>",
      name,
      rdns: "sh.walletwright.mock",
    } satisfies Eip6963Info,
    handle: createRpcHandler(account, toHex(chainId)),
    mount: mountEip1193Provider,
  });
  return account.address;
};

export { createRpcHandler, installMockWallet };
export type { MockWalletOptions };
