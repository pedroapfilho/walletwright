import { defineConfig } from "oxlint";
import awesomeness from "oxlint-config-awesomeness";

export default defineConfig({
  extends: [awesomeness],
  options: {
    typeAware: true,
    typeCheck: true,
  },
  overrides: [
    {
      files: ["**/__tests__/**/*.ts", "**/__tests__/**/*.tsx", "**/*.test.ts", "**/*.test.tsx"],
      rules: {
        "no-sync": "off",
        "number-literal-case": "off",
      },
    },
    {
      files: ["apps/**/*.ts", "apps/**/*.tsx"],
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
    {
      files: ["packages/walletwright/**/*.ts"],
      rules: {
        "no-await-in-loop": "off",
        "no-sync": "off",
        "react-doctor/async-await-in-loop": "off",
        "react-doctor/async-defer-await": "off",
        "react-doctor/js-index-maps": "off",
        "react-doctor/js-set-map-lookups": "off",
        "react-doctor/no-dynamic-import-path": "off",
        "react-doctor/server-sequential-independent-await": "off",
        "react-hooks/rules-of-hooks": "off",
      },
    },
    {
      files: ["packages/walletwright/src/fixtures.ts"],
      rules: {
        "no-empty-pattern": "off",
      },
    },
    {
      files: ["packages/walletwright/src/mock.ts", "packages/walletwright/src/mock-standard.ts"],
      rules: {
        "no-unsafe-type-assertion": "off",
      },
    },
    {
      files: ["apps/landing/**/*.tsx"],
      rules: {
        // Tailwind's preflight removes the list marker, and Safari/VoiceOver then drops the list
        // role along with it, so the "redundant" role is the only thing keeping the semantics.
        "jsx-a11y/no-redundant-roles": "off",
      },
    },
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
