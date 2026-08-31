import { spawnSync } from "node:child_process";

import { applyPortlessUrls } from "./portless-env.mjs";

const env = applyPortlessUrls({
  NEXT_PUBLIC_DOCS_URL: ["walletwright.docs"],
});

const { status } = spawnSync("pnpm", ["exec", "turbo", "run", "dev"], {
  env,
  stdio: "inherit",
});

process.exit(status ?? 1);
