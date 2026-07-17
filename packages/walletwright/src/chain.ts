import { Instance } from "prool";

/**
 * A running local EVM node for transaction and network tests. `walletwright/chain` is a separate
 * entry point: it needs `prool` and Foundry's `anvil` binary, which the core connect/sign flow does
 * not, so it stays out of the default install.
 */
export type LocalChain = {
  chainId: number;
  /** JSON-RPC endpoint to hand to the wallet (via `addNetwork` or `wallet_addEthereumChain`). */
  rpcUrl: string;
  stop: () => Promise<void>;
};

export type LocalChainOptions = {
  /** `anvil` binary to run. Defaults to `anvil` on `PATH` (Foundry's standard install location). */
  binary?: string;
  chainId?: number;
  /** Seed for the pre-funded accounts. Defaults to the public Hardhat/Anvil test mnemonic. */
  mnemonic?: string;
  port?: number;
};

// Anvil and Hardhat both default to this mnemonic and pre-fund account #0 as
// 0xf39F…92266 with 10000 ETH, the account walletwright's MetaMask setup already imports.
const TEST_MNEMONIC = "test test test test test test test test test test test junk";

const createLocalChain = async (options: LocalChainOptions = {}): Promise<LocalChain> => {
  const { binary = "anvil", chainId = 31_337, mnemonic = TEST_MNEMONIC, port = 8545 } = options;
  const instance = Instance.anvil({ binary, chainId, mnemonic, port });
  await instance.start();

  return {
    chainId,
    rpcUrl: `http://127.0.0.1:${port}`,
    stop: async () => {
      await instance.stop();
    },
  };
};

export { createLocalChain };
