import type { BrowserContext, Page } from "@playwright/test";
import type { PrivateKeyAccount } from "viem/accounts";
import { privateKeyToAccount } from "viem/accounts";

/**
 * A headless injected-wallet fake for dapp tests that don't need a real extension. It announces
 * itself over EIP-6963 and answers the EIP-1193 requests a connect/sign flow makes, signing with a
 * real key so signatures verify. `@walletwright/core/mock` is a separate entry point that needs
 * `viem` (optional peer); the extension-driving core doesn't.
 */
export type MockWalletOptions = {
  chainId?: number;
  /** Wallet name announced over EIP-6963. */
  name?: string;
  /** The account's private key. Defaults to anvil/hardhat account #0. */
  privateKey?: `0x${string}`;
};

const DEFAULT_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

type Rpc = { method: string; params?: ReadonlyArray<unknown> };

const toHex = (value: number): string => `0x${value.toString(16)}`;

const isHexMessage = (value: string): value is `0x${string}` => /^0x[\da-fA-F]*$/v.test(value);

/** The EIP-1193 handler a mock provider answers with. Exported for direct, browser-free testing. */
const createRpcHandler =
  (account: PrivateKeyAccount, chainIdHex: string) =>
  ({ method, params = [] }: Rpc): Promise<unknown> => {
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
  const chainIdHex = toHex(chainId);
  const handle = createRpcHandler(account, chainIdHex);

  const bindingName = "__walletwrightMockRpc";
  try {
    await target.exposeFunction(bindingName, (rpc: Rpc) => handle(rpc));
  } catch (error) {
    if (!(error instanceof Error && error.message.includes("already registered"))) {
      throw error;
    }
  }

  await target.addInitScript(
    ([binding, info]) => {
      const call = (window as unknown as Record<string, (rpc: Rpc) => Promise<unknown>>)[binding];
      const provider = {
        isMetaMask: true,
        on: () => provider,
        removeListener: () => provider,
        request: (rpc: Rpc) => call(rpc),
      };
      (window as unknown as { ethereum?: unknown }).ethereum = provider;

      const announce = () => {
        window.dispatchEvent(
          new CustomEvent("eip6963:announceProvider", {
            detail: Object.freeze({ info, provider }),
          }),
        );
      };
      window.addEventListener("eip6963:requestProvider", announce);
      announce();
    },
    [
      bindingName,
      {
        icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>",
        name,
        rdns: "sh.walletwright.mock",
        uuid: "00000000-0000-0000-0000-000000000000",
      },
    ] as const,
  );

  return account.address;
};

export { createRpcHandler, installMockWallet };
