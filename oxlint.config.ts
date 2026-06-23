import { defineConfig } from "oxlint";
import awesomeness from "oxlint-config-awesomeness";

export default defineConfig({
  extends: [awesomeness],
  overrides: [
    // oxfmt always lowercases hex literals, while `number-literal-case` wants
    // uppercase. The two tools conflict, so disable the oxlint rule for test
    // files where hex literals appear only as fixture values.
    {
      files: ["**/__tests__/**/*.ts", "**/__tests__/**/*.tsx", "**/*.test.ts", "**/*.test.tsx"],
      rules: {
        "number-literal-case": "off",
      },
    },
    // Demo apps are standalone references read top-to-bottom; accept length and
    // console logging that demonstrates callbacks firing.
    {
      files: ["apps/**/*.ts", "apps/**/*.tsx"],
      // Demo dapp + Playwright specs: ergonomic patterns over preset strictness.
      rules: {
        "max-lines": "off",
        "no-await-expression-member": "off",
        "no-await-in-loop": "off",
        "no-console": "off",
        "no-non-null-assertion": "off",
        "no-promise-executor-return": "off",
        "react-doctor/async-await-in-loop": "off",
        "require-unicode-regexp": "off",
      },
    },
    // walletwright drives a real browser: sequential `await` in polling/retry loops is by design
    // (each poll must wait), and the React/Next/doctor presets don't apply to a Node library
    // (e.g. `rules-of-hooks` false-positives on Playwright's `use` fixture argument).
    {
      files: ["packages/walletwright/**/*.ts"],
      rules: {
        "no-await-in-loop": "off",
        "react-doctor/async-await-in-loop": "off",
        "react-doctor/js-index-maps": "off",
        "react-doctor/no-dynamic-import-path": "off",
        "react-doctor/server-sequential-independent-await": "off",
        "react-hooks/rules-of-hooks": "off",
      },
    },
  ],
});
