import type { BrowserContext, Page } from "@playwright/test";
import { privateKeyToAccount } from "viem/accounts";

import type { BridgeCall } from "./mock/page-bridge";
import { installPageBridge } from "./mock/page-bridge";
import { createRpcHandler, type Rpc, type RpcResult } from "./mock/rpc";

/** Headless EIP-6963 and EIP-1193 mock that signs with a real key. */
type MockWalletOptions = {
  chainId?: number;
  /** Wallet name announced over EIP-6963. */
  name?: string;
  /** The account's private key. Defaults to anvil/hardhat account #0. */
  privateKey?: `0x${string}`;
};

const DEFAULT_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

type Eip6963Info = { icon: string; name: string; rdns: string };

const toHex = (value: number): `0x${string}` => `0x${value.toString(16)}`;

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

export { installMockWallet };

export type { MockWalletOptions };
