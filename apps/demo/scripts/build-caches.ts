import type { WalletKind } from "@walletwright/core";

const buildCaches = async (
  names: ReadonlyArray<WalletKind>,
  build: (name: WalletKind) => Promise<void>,
): Promise<void> => {
  // Each wallet owns a separate profile; duplicate selections must never race on that profile.
  const results = await Promise.allSettled(
    [...new Set(names)].map(async (name) => {
      await build(name);
    }),
  );
  const errors = results.flatMap((result) => {
    if (result.status === "fulfilled") {
      return [];
    }
    const reason: unknown = result.reason;
    return [
      reason instanceof Error ? reason : new Error("Wallet cache build failed", { cause: reason }),
    ];
  });
  if (errors.length > 0) {
    // Let every browser finish its cleanup before the CLI exits on a failed build.
    throw new AggregateError(errors, "One or more wallet cache builds failed");
  }
};

export { buildCaches };
