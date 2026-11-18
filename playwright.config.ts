import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E（里程碑 6 PR D）
 *
 * 連正式 Supabase，用 .env.local 的專用測試帳號（DEV_TEST_EMAIL／DEV_TEST_PASSWORD）。
 * 因為會寫正式資料庫，只在本機手動跑：`npm run e2e`，不放進 GitHub CI。
 * 測試建立的資料一律以 `[E2E]` 開頭，setup 先清一次殘留、teardown 跑完再清。
 */
loadEnvConfig(process.cwd());

const PORT = Number(process.env.E2E_PORT ?? 3000);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // 同一個測試帳號，平行跑會互相干擾（例如本月額度、總覽數字）
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  use: {
    baseURL,
    locale: "zh-TW",
    timezoneId: "Asia/Taipei",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /global\.setup\.ts/, teardown: "teardown" },
    { name: "teardown", testMatch: /global\.teardown\.ts/ },
    {
      name: "chromium",
      testMatch: /.*\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/user.json" },
    },
  ],
  webServer: {
    command: `npx next dev --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
