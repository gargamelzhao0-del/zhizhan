import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
const metadata = JSON.parse(await fs.readFile("package.json", "utf8"));
const endpoint = "https://updates.example.test/zhizhan/latest.json";
const feed = { format: "zhizhan-update", schemaVersion: 1, appId: "app.zhizhan.local", version: "9.0.0",
  versionCode: metadata.androidVersionCode + 10, minSdk: 26, publishedAt: "2026-10-07T15:00:00Z",
  notes: ["新增完整实验与参考答案", "下载校验后由 Android 系统确认安装"],
  apk: { url: "./example.apk", bytes: 6000000, sha256: "a".repeat(64) } };
const browser = await chromium.launch({ channel: "chrome", headless: true });
const issues = [], errors = [];
try {
  for (const mode of ["mobile", "desktop"]) {
    const page = await browser.newPage({ viewport: mode === "mobile" ? { width: 393, height: 852 } : { width: 1440, height: 1050 },
      isMobile: mode === "mobile", hasTouch: mode === "mobile" });
    page.on("pageerror", error => errors.push(error.message));
    await page.route(endpoint, route => route.fulfill({ contentType: "application/json", body: JSON.stringify(feed) }));
    await page.goto("http://127.0.0.1:8462/#settings");
    const panel = page.getByRole("region", { name: "软件更新", exact: true });
    await expect(panel.getByText(/尚未配置更新地址。配置后/)).toBeVisible();
    await panel.screenshot({ path: `release/previews/update-settings-${mode}.png` });
    await panel.getByRole("checkbox", { name: "自动检查新版本" }).uncheck();
    await panel.getByLabel("版本清单 HTTPS 地址").fill(endpoint);
    await panel.getByRole("button", { name: "保存更新地址" }).click();
    await panel.getByRole("button", { name: "检查更新", exact: true }).click();
    await expect(panel.getByText("发现新版本 9.0.0", { exact: true })).toBeVisible();
    await panel.screenshot({ path: `release/previews/update-available-${mode}.png` });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) issues.push(mode + ": horizontal overflow");
    await page.close();
  }
  const result = { passed: !issues.length && !errors.length, issues, pageErrors: errors, mockedFeed: true, androidInstallerTested: false };
  await fs.writeFile("docs/update-ui-audit.json", JSON.stringify(result, null, 2));
  if (!result.passed) throw new Error(JSON.stringify(result));
  console.log("Update UI screenshots and layout checks passed (mocked HTTPS feed, no deployment).");
} finally { await browser.close(); }
