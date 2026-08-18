import { z } from "zod";

/**
 * Wallets reject with an EIP-1193 error object (`{ code: 4001, message }`), not an `Error`, so
 * `String(error)` renders "[object Object]" for the commonest failure a dapp shows. An `Error` has
 * `.message` too, so reading it first needs no `instanceof` branch.
 */
const errorMessageSchema = z.object({ message: z.string() });

const toErrorMessage = <Value>(error: Value): string => {
  const result = errorMessageSchema.safeParse(error);
  return result.success ? result.data.message : String(error);
};

export { toErrorMessage };
