import { defineConfig, devices } from "@playwright/test";

const E2E_PORT = 3456;
const E2E_URL = `http://127.0.0.1:${E2E_PORT}`;
const productionUrl = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: productionUrl ?? E2E_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
  ],
  webServer: productionUrl
    ? undefined
    : {
        command: `npm run build && npm run start -- --port ${E2E_PORT}`,
        url: E2E_URL,
        reuseExistingServer: false,
        timeout: 180_000,
      },
});
