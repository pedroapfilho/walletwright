import nodeConfig from "@repo/config-vitest/node";
import { mergeConfig } from "vitest/config";

// walletwright is E2E-oriented (real browser extensions); the pure helpers are unit-tested, but we
// don't enforce the monorepo's default coverage floor here.
export default mergeConfig(nodeConfig, {
  test: {
    coverage: {
      thresholds: { branches: 0, functions: 0, lines: 0, statements: 0 },
    },
  },
});
