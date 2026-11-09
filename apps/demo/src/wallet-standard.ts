import { getWallets } from "@wallet-standard/app";

type StandardWallet = ReturnType<ReturnType<typeof getWallets>["get"]>[number];

type StandardAccount = StandardWallet["accounts"][number];

type ConnectFeature = {
  connect: () => Promise<{ accounts: ReadonlyArray<StandardAccount> }>;
};

type SolanaSignFeature = {
  signMessage: (input: {
    account: StandardAccount;
    message: Uint8Array;
  }) => Promise<ReadonlyArray<{ signature: Uint8Array }>>;
};

type SuiSignFeature = {
  signPersonalMessage: (input: {
    account: StandardAccount;
    message: Uint8Array;
  }) => Promise<{ signature: string }>;
};

const toHex = (bytes: Uint8Array): string =>
  `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;

/** The first registered wallet on a chain family (`solana:`, `sui:`), whichever extension it is. */
const findStandardWallet = (chainPrefix: string): StandardWallet | undefined =>
  getWallets()
    .get()
    .find((wallet) => wallet.chains.some((chain) => chain.startsWith(chainPrefix)));

const connectStandard = async (wallet: StandardWallet): Promise<StandardAccount> => {
  // SAFETY: Wallet Standard identifies this feature by name and requires its connect contract.
  const feature = wallet.features["standard:connect"] as ConnectFeature | undefined;

  if (!feature) {
    throw new Error(`${wallet.name} lacks standard:connect`);
  }

  const { accounts } = await feature.connect();
  const account = accounts.at(0);

  if (!account) {
    throw new Error(`${wallet.name} standard:connect returned no accounts`);
  }

  return account;
};

const signSolanaMessage = async (
  wallet: StandardWallet,
  account: StandardAccount,
  message: string,
): Promise<string> => {
  // SAFETY: Solana Wallet Standard identifies this feature by name and fixes its method contract.
  const feature = wallet.features["solana:signMessage"] as SolanaSignFeature;

  const outputs = await feature.signMessage({
    account,
    message: new TextEncoder().encode(message),
  });

  const output = outputs.at(0);

  if (!output?.signature) {
    throw new Error("solana:signMessage returned no signature");
  }

  return toHex(output.signature);
};

const signSuiMessage = async (
  wallet: StandardWallet,
  account: StandardAccount,
  message: string,
): Promise<string> => {
  // SAFETY: Sui Wallet Standard identifies this feature by name and fixes its method contract.
  const feature = wallet.features["sui:signPersonalMessage"] as SuiSignFeature;

  const { signature } = await feature.signPersonalMessage({
    account,
    message: new TextEncoder().encode(message),
  });

  if (typeof signature !== "string" || !signature) {
    throw new Error("sui:signPersonalMessage returned no signature");
  }

  return signature;
};

export { connectStandard, findStandardWallet, signSolanaMessage, signSuiMessage, toHex };

export type { StandardAccount, StandardWallet };
