import { defineConfig, devices } from "@playwright/test";
import { loadEnv } from "vite";

// Vite reads .env for the page on its own, but the specs' `process.env` gates (e.g. the Privy spec)
// don't, so load it here too. Real env vars win over .env values.
for (const [key, value] of Object.entries(loadEnv("", import.meta.dirname, "VITE_"))) {
  process.env[key] ??= value;
}

// Headless (Playwright's default) for the wallets whose headless approval flow is verified; the
// Slush and Solflare specs opt themselves back into headed with `test.use({ headless: false })`.
export default defineConfig({
  expect: { timeout: 30_000 },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  reporter: "line",
  retries: 2,
  testDir: "./tests",
  // A single test can wait out two approvals, and on a loaded CI runner each one costs up to 60s to
  // reach plus 45s for MetaMask to render the button that settles it.
  timeout: 300_000,
  use: { baseURL: "http://localhost:3000", trace: "off" },
  webServer: {
    command: "pnpm dev",
    reuseExistingServer: !process.env.CI,
    url: "http://localhost:3000",
  },
  workers: 1,
});
