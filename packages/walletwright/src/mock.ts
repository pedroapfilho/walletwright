import type { BrowserContext, Page } from "@playwright/test";
import { privateKeyToAccount } from "viem/accounts";

/**
 * A headless injected-wallet fake for dapp tests that don't need a real extension. It announces
 * itself over EIP-6963 and answers the EIP-1193 requests a connect/sign flow makes, signing with a
 * real key so signatures verify. `walletwright/mock` is a separate entry point that needs `viem`
 * (optional peer); the extension-driving core doesn't.
 */
export type MockWalletOptions = {
  chainId?: number;
  /** Wallet name announced over EIP-6963. */
  name?: string;
  /** The account's private key. Defaults to anvil/hardhat account #0. */
  privateKey?: `0x${string}`;
};

// Anvil/Hardhat account #0, address 0xf39F…92266.
const DEFAULT_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

type Rpc = { method: string; params?: ReadonlyArray<unknown> };

const toHex = (value: number): string => `0x${value.toString(16)}`;

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

  const handle = ({ method, params = [] }: Rpc): Promise<unknown> => {
    switch (method) {
      case "eth_requestAccounts":
      case "eth_accounts": {
        return Promise.resolve([account.address]);
      }
      case "eth_chainId": {
        return Promise.resolve(chainIdHex);
      }
      case "personal_sign": {
        // params: [message, address]. Dapps pass either a 0x-hex message or a plain UTF-8 string.
        const message = params[0] as string;
        return account.signMessage({
          message: /^0x[0-9a-fA-F]*$/v.test(message) ? { raw: message as `0x${string}` } : message,
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

  const bindingName = "__walletwrightMockRpc";
  try {
    await target.exposeFunction(bindingName, (rpc: Rpc) => handle(rpc));
  } catch (error) {
    // Playwright rejects a second exposeFunction with the same name; the bridge is already there,
    // so a repeat install (e.g. in a per-test hook) is fine. Any other error is real.
    if (!(error instanceof Error && error.message.includes("already registered"))) {
      throw error;
    }
  }

  await target.addInitScript(
    ([binding, info]) => {
      const call = (window as unknown as Record<string, (rpc: Rpc) => Promise<unknown>>)[binding];
      const provider = {
        isMetaMask: true,
        request: (rpc: Rpc) => call(rpc),
        // Minimal event surface so wagmi/web3-onboard don't throw wiring listeners.
        on: () => provider,
        removeListener: () => provider,
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

export { installMockWallet };
