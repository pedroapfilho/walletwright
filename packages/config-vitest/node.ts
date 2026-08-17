import { defineConfig } from "vitest/config";

const nodeConfig = defineConfig({
  test: {
    coverage: {
      exclude: [
        "**/__tests__/**",
        "**/*.test.{ts,tsx}",
        "**/*.config.{ts,js,mjs,cjs}",
        "**/*.d.ts",
        "**/dist/**",
        "**/node_modules/**",
      ],
      include: ["src/**/*.{ts,tsx}"],
      provider: "v8",
      /**
       * Reported, not gated: consumers drive a real browser through Playwright, so a vitest number
       * covers the pure-logic slice only (~38% here) and any threshold against it misleads. The gate
       * that used to live here was cancelled by a per-package override that zeroed it.
       */
      reporter: ["text", "html", "json-summary"],
    },
    environment: "node",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    passWithNoTests: true,
  },
});

export default nodeConfig;
