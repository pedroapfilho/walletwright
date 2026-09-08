import { execFileSync } from "node:child_process";

import { defineConfig, devices } from "@playwright/test";
import { loadEnv } from "vite";

for (const [key, value] of Object.entries(loadEnv("", import.meta.dirname, "VITE_"))) {
  process.env[key] ??= value;
}

const getPortlessUrl = (name: string) => {
  if (process.env.CI) {
    return undefined;
  }
  try {
    return execFileSync("portless", ["get", name], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
};

const demoUrl =
  process.env.PLAYWRIGHT_WEB_URL ?? getPortlessUrl("walletwright.demo") ?? "http://127.0.0.1:3000";

export default defineConfig({
  expect: { timeout: 30_000 },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  reporter: "line",
  retries: 2,
  testDir: "./tests",
  timeout: 300_000,
  // A wallet failure on CI can only be read after the fact, and the line reporter says what timed
  // out but not what the dapp or the wallet was showing. Keep the trace for a failure there; stay
  // off locally, where the browser is in front of you.
  use: {
    baseURL: demoUrl,
    headless: false,
    trace: process.env.CI ? "retain-on-failure" : "off",
  },
  webServer: process.env.CI
    ? [
        {
          command: "node_modules/.bin/vite --host 127.0.0.1 --port 3000 --strictPort",
          stderr: "pipe",
          stdout: "pipe",
          timeout: 120_000,
          url: demoUrl,
        },
      ]
    : [],
  workers: 1,
});
