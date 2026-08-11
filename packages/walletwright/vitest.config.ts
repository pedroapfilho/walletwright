import nodeConfig from "@repo/config-vitest/node";
import { mergeConfig } from "vitest/config";

export default mergeConfig(nodeConfig, {
  test: {
    coverage: {
      thresholds: { branches: 0, functions: 0, lines: 0, statements: 0 },
    },
  },
});
