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
  use: { baseURL: demoUrl, headless: false, trace: "off" },
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
