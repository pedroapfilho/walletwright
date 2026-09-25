import { defineConfig } from "oxlint";
import awesomeness from "oxlint-config-awesomeness";
import shadcn from "oxlint-config-awesomeness/shadcn";

export default defineConfig({
  extends: [awesomeness, shadcn],
  // Generated runtime is byte-verified and tested in the control plane.
  ignorePatterns: [".github/ci/*.mjs"],
  overrides: [
    // Custom selectors are defined in the landing page.css side-effect import.
    {
      files: ["apps/landing/src/components/code-tabs.tsx"],
      rules: {
        "shadcn/no-unknown-classes": [
          "error",
          {
            allow: ["world-tab", "world-tablist"],
          },
        ],
      },
    },
    {
      files: ["apps/landing/src/components/code-block.tsx"],
      rules: {
        "shadcn/no-unknown-classes": [
          "error",
          {
            allow: ["world-code-body", "world-code-head", "world-code-wrap"],
          },
        ],
      },
    },
    {
      files: [
        "apps/landing/src/app/layout.tsx",
        "apps/landing/src/app/not-found.tsx",
        "apps/landing/src/app/page.tsx",
      ],
      rules: {
        "shadcn/no-unknown-classes": [
          "error",
          {
            allow: [
              "ref",
              "ref-actions",
              "ref-api",
              "ref-api-row",
              "ref-badges",
              "ref-body",
              "ref-brand",
              "ref-btn",
              "ref-btn-ghost",
              "ref-btn-primary",
              "ref-caption",
              "ref-card",
              "ref-cards",
              "ref-code",
              "ref-footer",
              "ref-footer-row",
              "ref-hero",
              "ref-install",
              "ref-install-code",
              "ref-lede",
              "ref-link",
              "ref-mark",
              "ref-measure",
              "ref-nav",
              "ref-nav-links",
              "ref-nav-row",
              "ref-section",
              "ref-two-col",
              "ref-visually-hidden",
              "ref-wallet-chains",
              "ref-wallet-name",
              "ref-wallet-spec",
              "ref-wallets",
              "ref-wordmark",
            ],
          },
        ],
      },
    },
    {
      files: ["apps/**/*.ts", "apps/**/*.tsx"],
      rules: {
        "max-lines": "off",
        "no-await-expression-member": "off",
        "no-console": "off",
        "no-non-null-assertion": "off",
        "no-promise-executor-return": "off",
      },
    },
    {
      files: ["packages/walletwright/**/*.ts"],
      rules: {
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
  rules: {
    "shadcn/no-restyle": [
      "error",
      {
        allow: ["layout"],
        contracts: [
          {
            allow: ["layout", "gap-*"],
            pattern: "^PopoverTrigger$",
          },
        ],
      },
    ],
  },
});
