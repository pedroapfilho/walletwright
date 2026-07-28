import { defineConfig } from "oxlint";
import awesomeness from "oxlint-config-awesomeness";

export default defineConfig({
  extends: [awesomeness],
  options: {
    typeAware: true,
    typeCheck: true,
  },
  overrides: [
    // oxfmt always lowercases hex literals, while `number-literal-case` wants
    // uppercase. The two tools conflict, so disable the oxlint rule for test
    // files where hex literals appear only as fixture values.
    {
      files: ["**/__tests__/**/*.ts", "**/__tests__/**/*.tsx", "**/*.test.ts", "**/*.test.tsx"],
      rules: {
        // Fixtures are built and torn down synchronously; an async fs call would race the test body.
        "no-sync": "off",
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
        // Extension ids and cache lookups are computed inside synchronous functions the public API
        // exposes as sync; the reads are one-shot local file probes, not a hot path.
        "no-sync": "off",
        "react-doctor/async-await-in-loop": "off",
        // Settling before a click is the point of the await, not an accident of ordering.
        "react-doctor/async-defer-await": "off",
        "react-doctor/js-index-maps": "off",
        // Fires on `String.includes` and on 2-element label arrays, neither of which scales badly.
        "react-doctor/js-set-map-lookups": "off",
        "react-doctor/no-dynamic-import-path": "off",
        "react-doctor/server-sequential-independent-await": "off",
        "react-hooks/rules-of-hooks": "off",
      },
    },
    // The mock providers' bodies are serialized into the page by `addInitScript`, so reaching the
    // injected binding or `window.ethereum` means asserting onto a window TypeScript can't see.
    {
      files: ["packages/walletwright/src/mock.ts", "packages/walletwright/src/mock-standard.ts"],
      rules: {
        "no-unsafe-type-assertion": "off",
      },
    },
    // The demo dapp is a vanilla-DOM reference: handlers are async by nature and the provider it
    // talks to is whatever the injected wallet put on `window`.
    {
      files: ["apps/demo/**/*.ts", "apps/demo/**/*.tsx"],
      rules: {
        "no-misused-promises": "off",
        "no-unnecessary-type-parameters": "off",
        "no-unsafe-type-assertion": "off",
        "strict-boolean-expressions": "off",
        "strict-void-return": "off",
      },
    },
  ],
});
