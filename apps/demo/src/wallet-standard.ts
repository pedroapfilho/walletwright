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

const connectStandard = async (wallet: StandardWallet): Promise<StandardAccount> => {
  const feature = wallet.features["standard:connect"] as
    | { connect: () => Promise<{ accounts: ReadonlyArray<StandardAccount> }> }
    | undefined;
  if (!feature) {
    throw new Error(`${wallet.name} lacks standard:connect`);
  }
  const { accounts } = await feature.connect();
  const account = accounts[0];
  if (!account) {
    throw new Error(`${wallet.name} standard:connect returned no accounts`);
  }
  return account;
};

export { connectStandard, findStandardWallet };
export type { StandardAccount, StandardWallet };
