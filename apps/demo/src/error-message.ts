/**
 * Wallets reject with an EIP-1193 error object (`{ code: 4001, message }`), not an `Error`, so
 * `String(error)` renders "[object Object]" for the commonest failure a dapp shows. An `Error` has
 * `.message` too, so reading it first needs no `instanceof` branch.
 */
const toErrorMessage = (error: unknown): string =>
  (error as { message?: string } | null | undefined)?.message ?? String(error);

export { toErrorMessage };
