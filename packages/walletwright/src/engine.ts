import { build } from "./internal/cache";
import { runDirectly } from "./internal/controller";
import { type LaunchedWallet, launch } from "./internal/launch";
import type { WalletSetup } from "./types";
import { wallets } from "./wallets/index";

/** Onboard the setup's wallet once and cache the profile, returning its directory. */
const buildCache = (setup: WalletSetup, options?: { headless?: boolean }): Promise<string> =>
  build(wallets[setup.wallet], setup, options);

/** Launch and unlock a disposable profile copy. Headless mode requires verified wallet support. */
const launchWallet = (
  setup: WalletSetup,
  { headless = false }: { headless?: boolean } = {},
): Promise<LaunchedWallet> => launch(wallets[setup.wallet], setup, { headless, step: runDirectly });

export { buildCache, launchWallet };
