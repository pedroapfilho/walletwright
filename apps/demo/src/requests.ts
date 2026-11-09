import type { NetworkConfig } from "@walletwright/core";

/** The anvil chain the network and transaction specs run against. */
const LOCAL_CHAIN = {
  chainId: 31_337,
  name: "Walletwright Local",
  rpcUrl: "http://127.0.0.1:8545",
  symbol: "ETH",
} as const satisfies NetworkConfig;

const LOCAL_CHAIN_HEX = `0x${LOCAL_CHAIN.chainId.toString(16)}`;

/** What the Wallet Standard Solana section signs, which the mock spec verifies against its key. */
const SOLANA_MESSAGE = "Hello walletwright Solana";

export { LOCAL_CHAIN, LOCAL_CHAIN_HEX, SOLANA_MESSAGE };
