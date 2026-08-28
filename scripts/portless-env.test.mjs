import assert from "node:assert/strict";
import test from "node:test";

import { applyPortlessUrls } from "./portless-env.mjs";

await test("resolves scalar and comma-separated Portless URLs", () => {
  const env = {};
  applyPortlessUrls(
    { DOCS_URL: "walletwright.docs", ORIGINS: ["walletwright.landing", "walletwright.demo"] },
    { env, resolveUrl: (name) => `https://branch.${name}.localhost` },
  );
  assert.deepEqual(env, {
    DOCS_URL: "https://branch.walletwright.docs.localhost",
    ORIGINS:
      "https://branch.walletwright.landing.localhost,https://branch.walletwright.demo.localhost",
  });
});

await test("preserves explicitly configured environment values", () => {
  const env = { DOCS_URL: "https://docs.example.com" };
  applyPortlessUrls(
    { DOCS_URL: "walletwright.docs" },
    {
      env,
      resolveUrl: () => {
        throw new Error("should not resolve an explicit value");
      },
    },
  );
  assert.equal(env.DOCS_URL, "https://docs.example.com");
});
