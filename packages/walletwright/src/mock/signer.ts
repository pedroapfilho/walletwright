import { createPrivateKey, createPublicKey, sign } from "node:crypto";

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

    for (const [index, digit] of digits.entries()) {
      carry += digit * 256;
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

/** `message` is required: defaulting it would sign the empty message instead of rejecting. */
type StandardRequest = { message: Array<number>; method: string };

const createStandardHandler =
  (seed: Buffer) =>
  ({ message, method }: StandardRequest): Promise<Array<number>> => {
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

export { createStandardHandler, encodeBase58, privateKeyFromSeed, rawPublicKey };

export type { StandardRequest };
