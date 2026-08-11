import { defineConfig, devices } from "@playwright/test";
import { loadEnv } from "vite";

for (const [key, value] of Object.entries(loadEnv("", import.meta.dirname, "VITE_"))) {
  process.env[key] ??= value;
}

export default defineConfig({
  expect: { timeout: 30_000 },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  reporter: "line",
  retries: 2,
  testDir: "./tests",
  timeout: 300_000,
  use: { baseURL: "http://localhost:3000", headless: false, trace: "off" },
  webServer: {
    command: "pnpm dev",
    reuseExistingServer: !process.env.CI,
    url: "http://localhost:3000",
  },
  workers: 1,
});
