import nodeConfig from "@repo/config-vitest/node";
import { defineConfig, mergeConfig } from "vitest/config";

const libraryConfig = mergeConfig(
  nodeConfig,
  defineConfig({
    test: {
      coverage: {
        // Reported, not gated: consumers drive a real browser through Playwright, so a vitest number
        // covers the pure-logic slice only (~38% here) and any threshold against it misleads.
        thresholds: { branches: 0, functions: 0, lines: 0, statements: 0 },
      },
    },
  }),
);

export default libraryConfig;
