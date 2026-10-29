import { defineConfig, devices } from "@playwright/test";
const port = process.env.ZHIZHAN_TEST_PORT || "8462";
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 15000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    channel: "chrome",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npx vite --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.ZHIZHAN_TEST_PORT,
    timeout: 30000,
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1050 } } },
    {
      name: "mobile",
      use: {
        viewport: { width: 393, height: 852 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 1,
      },
    },
  ],
});
