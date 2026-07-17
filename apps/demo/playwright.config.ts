import { defineConfig, devices } from "@playwright/test";
import { loadEnv } from "vite";

// Vite reads .env for the page on its own, but the specs' `process.env` gates (e.g. the Privy spec)
// don't, so load it here too. Real env vars win over .env values.
for (const [key, value] of Object.entries(loadEnv("", import.meta.dirname, "VITE_"))) {
  process.env[key] ??= value;
}

// Wallet approval popups only open headed; on CI run under a virtual display (e.g. xvfb-run).
export default defineConfig({
  expect: { timeout: 30_000 },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  reporter: "line",
  retries: 2,
  testDir: "./tests",
  timeout: 120_000,
  use: { baseURL: "http://localhost:3000", trace: "off" },
  webServer: {
    command: "pnpm dev",
    reuseExistingServer: !process.env.CI,
    url: "http://localhost:3000",
  },
  workers: 1,
});
