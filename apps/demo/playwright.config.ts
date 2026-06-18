import { defineConfig, devices } from "@playwright/test";

// Wallet approval popups only open headed; on CI run under a virtual display (e.g. xvfb-run).
export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  expect: { timeout: 30_000 },
  retries: 2,
  workers: 1,
  reporter: "line",
  use: { baseURL: "http://localhost:3000", trace: "off" },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
