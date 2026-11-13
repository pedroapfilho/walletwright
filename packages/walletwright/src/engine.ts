import { build } from "./internal/cache";
import { runDirectly } from "./internal/controller";
import { launch } from "./internal/launch";
import type { LaunchedWallet, WalletSetup } from "./types";
import { wallets } from "./wallets/index";

/**
 * Onboard the setup's wallet and cache the profile, replacing an earlier one, and return its
 * directory. Headless mode requires verified wallet support.
 */
const buildCache = (setup: WalletSetup, options?: { headless?: boolean }): Promise<string> =>
  build(wallets[setup.wallet], setup, options);

/** Launch and unlock a disposable profile copy. Headless mode requires verified wallet support. */
const launchWallet = (
  setup: WalletSetup,
  { headless = false }: { headless?: boolean } = {},
): Promise<LaunchedWallet> => launch(wallets[setup.wallet], setup, { headless, step: runDirectly });

export { buildCache, launchWallet };
