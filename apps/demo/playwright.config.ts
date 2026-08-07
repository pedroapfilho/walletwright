import { defineConfig, devices } from "@playwright/test";
import { loadEnv } from "vite";

// Vite reads .env for the page on its own, but the specs' `process.env` gates (e.g. the Privy spec)
// don't, so load it here too. Real env vars win over .env values.
for (const [key, value] of Object.entries(loadEnv("", import.meta.dirname, "VITE_"))) {
  process.env[key] ??= value;
}

// Headed by default, because most of these wallets need a real window for their approvals; the
// Phantom and Rabby specs opt back into headless, which is verified for them.
export default defineConfig({
  expect: { timeout: 30_000 },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  reporter: "line",
  retries: 2,
  testDir: "./tests",
  // A single test can wait out two approvals, and on a loaded CI runner each one costs up to 60s to
  // reach plus 45s for MetaMask to render the button that settles it.
  timeout: 300_000,
  use: { baseURL: "http://localhost:3000", headless: false, trace: "off" },
  webServer: {
    command: "pnpm dev",
    reuseExistingServer: !process.env.CI,
    url: "http://localhost:3000",
  },
  workers: 1,
});
