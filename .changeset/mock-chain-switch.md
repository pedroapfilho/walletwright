---
"@walletwright/core": patch
---

The EVM mock now tracks chain switches: after `wallet_switchEthereumChain` or `wallet_addEthereumChain`, `eth_chainId` reports the requested chain instead of the one the mock was installed with. Both methods reject unless `params[0].chainId` is a 0x-prefixed hex chain id. Each mock install also announces a random UUIDv4 over EIP-6963, as the spec asks, in place of a counter-derived one.
