import { createPrivateKey, createPublicKey, sign } from "node:crypto";

import type { BrowserContext, Page } from "@playwright/test";

/**
 * A headless Wallet-Standard fake for Solana dapp tests that don't need a real extension. It
 * hand-rolls the Wallet-Standard registration protocol (no browser-side library) and answers
 * `standard:connect` plus `solana:signMessage`, signing with a real ed25519 key so signatures
 * verify. Isolated from the EVM `mock.ts`; `walletwright/mock-standard` is its own entry point.
 *
 * ed25519 signing runs Node-side (viem is secp256k1-only), reusing the same exposeFunction bridge
 * pattern as the EVM mock. No extra dependency: Node's built-in `crypto` signs ed25519 natively.
 */
type MockEcosystem = "svm";

type MockStandardWalletOptions = {
  ecosystem?: MockEcosystem;
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

// A fixed 32-byte seed so the derived Solana address is stable across runs.
const DEFAULT_SEED_HEX = "0101010101010101010101010101010101010101010101010101010101010101";

const PKCS8_ED25519_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

const encodeBase58 = (bytes: Uint8Array): string => {
  let leadingZeros = 0;
  while (leadingZeros < bytes.length && bytes[leadingZeros] === 0) {
    leadingZeros += 1;
  }
  const digits: Array<number> = [];
  for (const byte of bytes) {
    let carry = byte;
    for (let index = 0; index < digits.length; index += 1) {
      carry += (digits[index] as number) * 256;
      digits[index] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  const prefix = "1".repeat(leadingZeros);
  const body = digits
    .toReversed()
    .map((digit) => BASE58_ALPHABET[digit])
    .join("");
  return prefix + body;
};

const privateKeyFromSeed = (seed: Buffer) =>
  createPrivateKey({
    format: "der",
    key: Buffer.concat([PKCS8_ED25519_PREFIX, seed]),
    type: "pkcs8",
  });

const rawPublicKey = (seed: Buffer): Buffer => {
  const spki = createPublicKey(privateKeyFromSeed(seed)).export({ format: "der", type: "spki" });
  return spki.subarray(-32);
};

const signEd25519 = (seed: Buffer, message: Uint8Array): Array<number> => [
  ...sign(null, Buffer.from(message), privateKeyFromSeed(seed)),
];

const SVM_CHAINS = ["solana:mainnet", "solana:devnet"] as const;

type BridgeRequest = { message?: Array<number>; method: string };

const createStandardHandler =
  (seed: Buffer) =>
  ({ message = [], method }: BridgeRequest): Promise<Array<number>> => {
    switch (method) {
      case "solana:signMessage": {
        return Promise.resolve(signEd25519(seed, Uint8Array.from(message)));
      }
      default: {
        return Promise.reject(
          new Error(`[walletwright/mock-standard] unsupported method: ${method}`),
        );
      }
    }
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
  const { ecosystem = "svm", name = "Walletwright Mock", seedHex = DEFAULT_SEED_HEX } = options;
  if (ecosystem !== "svm") {
    throw new Error(`[walletwright/mock-standard] prototype supports only svm, got ${ecosystem}`);
  }
  const seed = Buffer.from(seedHex, "hex");
  if (seed.length !== 32) {
    throw new Error("[walletwright/mock-standard] seedHex must be 32 bytes");
  }
  const publicKey = rawPublicKey(seed);
  const address = encodeBase58(publicKey);
  const publicKeyHex = publicKey.toString("hex");
  const handle = createStandardHandler(seed);

  const bindingName = "__walletwrightMockStandardSign";
  try {
    await target.exposeFunction(bindingName, (rpc: BridgeRequest) => handle(rpc));
  } catch (error) {
    if (!(error instanceof Error && error.message.includes("already registered"))) {
      throw error;
    }
  }

  await target.addInitScript(
    ([binding, info]) => {
      const call = (
        window as unknown as Record<string, (rpc: BridgeRequest) => Promise<Array<number>>>
      )[binding];
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

      const callback = (api: { register: (w: typeof wallet) => void }) => api.register(wallet);
      try {
        window.dispatchEvent(
          new CustomEvent("wallet-standard:register-wallet", { detail: callback }),
        );
      } catch {
        // The app may not be listening yet; the app-ready handler below covers that case.
      }
      window.addEventListener("wallet-standard:app-ready", (event) => {
        callback((event as CustomEvent).detail);
      });
    },
    [
      bindingName,
      {
        address,
        chains: [...SVM_CHAINS],
        icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>",
        name,
        publicKeyHex,
      },
    ] as const,
  );

  return { address, publicKeyHex };
};

export { createStandardHandler, encodeBase58, installMockStandardWallet, privateKeyFromSeed };
export type { MockEcosystem, MockStandardAccount, MockStandardWalletOptions };
