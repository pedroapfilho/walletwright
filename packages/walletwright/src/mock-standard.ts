import type { BrowserContext, Page } from "@playwright/test";

import type { BridgeCall } from "./mock/page-bridge";
import { installPageBridge } from "./mock/page-bridge";
import {
  createStandardHandler,
  encodeBase58,
  rawPublicKey,
  type StandardRequest,
} from "./mock/signer";

/** Headless Wallet-Standard Solana mock that signs messages with Node's ed25519 implementation. */
type MockStandardWalletOptions = {
  /** Wallet name announced over Wallet Standard. */
  name?: string;
  /** 32-byte ed25519 seed as hex. Defaults to a fixed test seed so the address is stable. */
  seedHex?: string;
};

type MockStandardAccount = {
  address: string;
  /** Raw 32-byte ed25519 public key, hex-encoded. */
  publicKeyHex: string;
};

const DEFAULT_SEED_HEX = "0101010101010101010101010101010101010101010101010101010101010101";

const SVM_CHAINS = ["solana:mainnet", "solana:devnet"] as const;

type StandardInfo = {
  address: string;
  chains: ReadonlyArray<string>;
  icon: string;
  name: string;
  publicKeyHex: string;
};

const mountStandardWallet = (
  call: BridgeCall<StandardRequest, Array<number>>,
  info: StandardInfo,
) => {
  const publicKeyBytes = Uint8Array.from(
    (info.publicKeyHex.match(/.{2}/gv) ?? []).map((byte) => Number.parseInt(byte, 16)),
  );

  const account = {
    address: info.address,
    chains: info.chains,
    features: ["solana:signMessage"],
    label: info.name,
    publicKey: publicKeyBytes,
  };

  const wallet = {
    accounts: [account],
    chains: info.chains,
    features: {
      "solana:signMessage": {
        signMessage: (...inputs: Array<{ message: Uint8Array }>) =>
          Promise.all(
            inputs.map(async ({ message }) => ({
              signature: Uint8Array.from(
                await call({ message: [...message], method: "solana:signMessage" }),
              ),
              signedMessage: message,
            })),
          ),
        version: "1.0.0",
      },
      "standard:connect": {
        connect: () => Promise.resolve({ accounts: [account] }),
        version: "1.0.0",
      },
      "standard:events": {
        on: () => () => {},
        version: "1.0.0",
      },
    },
    icon: info.icon,
    name: info.name,
    version: "1.0.0" as const,
  };

  const callback = (api: { register: (w: typeof wallet) => void }) => {
    api.register(wallet);
  };

  try {
    window.dispatchEvent(new CustomEvent("wallet-standard:register-wallet", { detail: callback }));
  } catch {
    // The app may not be listening yet; the app-ready handler below covers that case.
  }

  window.addEventListener("wallet-standard:app-ready", (event) => {
    // SAFETY: Wallet Standard dispatches this named event with the register callback contract.
    callback((event as CustomEvent<{ register: (w: typeof wallet) => void }>).detail);
  });
};

/**
 * Install the headless Wallet-Standard mock for Solana connect + sign on a context (every page) or a
 * single page. Call before `goto`, so the wallet is registered when the dapp discovers wallets.
 * Returns the account it announces so a test can verify signatures against the public key.
 */
const installMockStandardWallet = async (
  target: BrowserContext | Page,
  options: MockStandardWalletOptions = {},
): Promise<MockStandardAccount> => {
  const { name = "Walletwright Mock", seedHex = DEFAULT_SEED_HEX } = options;
  const seed = Buffer.from(seedHex, "hex");

  if (seed.length !== 32) {
    throw new Error("[walletwright/mock-standard] seedHex must be 32 bytes");
  }

  const publicKey = rawPublicKey(seed);
  const address = encodeBase58(publicKey);
  const publicKeyHex = publicKey.toString("hex");
  await installPageBridge(target, {
    data: {
      address,
      chains: [...SVM_CHAINS],
      icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>",
      name,
      publicKeyHex,
    } satisfies StandardInfo,
    handle: createStandardHandler(seed),
    mount: mountStandardWallet,
  });

  return { address, publicKeyHex };
};

export { installMockStandardWallet };

export type { MockStandardAccount, MockStandardWalletOptions };
