import { getWallets } from "@wallet-standard/app";

type StandardAccount = { address: string };
type StandardWallet = {
  accounts: ReadonlyArray<StandardAccount>;
  chains: ReadonlyArray<string>;
  features: Record<string, unknown>;
  name: string;
};

const findStandardWallet = (predicate: (wallet: StandardWallet) => boolean) =>
  getWallets()
    .get()
    .find((wallet) => predicate(wallet as StandardWallet)) as StandardWallet | undefined;

const connectStandard = async (wallet: StandardWallet): Promise<StandardAccount | undefined> => {
  const feature = wallet.features["standard:connect"] as {
    connect: () => Promise<{ accounts: ReadonlyArray<StandardAccount> }>;
  };
  const { accounts } = await feature.connect();
  return accounts[0];
};

export { connectStandard, findStandardWallet };
export type { StandardAccount, StandardWallet };
