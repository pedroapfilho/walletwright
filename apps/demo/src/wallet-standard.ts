import { getWallets } from "@wallet-standard/app";

type StandardWallet = ReturnType<ReturnType<typeof getWallets>["get"]>[number];
type StandardAccount = StandardWallet["accounts"][number];
type ConnectFeature = {
  connect: () => Promise<{ accounts: ReadonlyArray<StandardAccount> }>;
};

const findStandardWallet = (predicate: (wallet: StandardWallet) => boolean) =>
  getWallets().get().find(predicate);

const connectStandard = async (wallet: StandardWallet): Promise<StandardAccount> => {
  // SAFETY: Wallet Standard identifies this feature by name and requires its connect contract.
  const feature = wallet.features["standard:connect"] as ConnectFeature | undefined;
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
