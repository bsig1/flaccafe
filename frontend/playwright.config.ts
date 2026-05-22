import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.playwright.ts",
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  webServer: {
    command: "npm run build && npm run preview:smoke",
    url: "http://127.0.0.1:1421",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  use: {
    baseURL: "http://127.0.0.1:1421",
    channel: "msedge",
    trace: "retain-on-failure",
  },
});
