import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";

// The running preview can be an older release. Supply this working tree's seed
// into an isolated test context; do not change the user's database or server.
test.beforeEach(async ({ page }) => {
  await page.route("**/seed/catalog.json", async route => {
    await route.fulfill({ path: "public/seed/catalog.json", contentType: "application/json" });
  });
  await page.route("**/seed/assets/**", async route => {
    const name = new URL(route.request().url()).pathname.split("/").pop()!;
    if (!/^(source|lesson)-[a-f0-9]{24}-[a-f0-9]{16}\.bin$/.test(name)) throw Error("Unexpected seed path");
    await route.fulfill({ body: await fs.readFile(`public/seed/assets/${name}`), contentType: "application/octet-stream" });
  });
});

test("project experiments and source policies remain readable offline on a narrow phone", async ({ page, context }, info) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/#article/handbook-23");
  await expect(page.locator(".reading-paper>h1")).toContainText("分级实验");
  await context.setOffline(true);
  for (const [name, content] of [["audio_budget.py", "def "], ["inspect_na_frame.py", "def "], ["owner_epoch.py", "epoch"], ["frame_roundtrip.py", "audio_frame.c"]]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.locator(".asset-code")).toContainText(content);
    await page.getByRole("button", { name: "关闭弹窗", exact: true }).click();
  }
  await page.evaluate(() => { location.hash = "#article/handbook-19"; });
  await expect(page.locator(".prose")).toContainText("下载准入和新固件确认使用不同电量规则");
  await page.getByRole("button", { name: "nuwax_ota_power_policy.h", exact: true }).click();
  await expect(page.locator(".asset-code")).toContainText("nuwax_ota_power_evaluate_admission");
  await page.getByRole("button", { name: "关闭弹窗", exact: true }).click();
  await page.evaluate(() => { location.hash = "#article/handbook-00"; });
  await page.getByRole("button", { name: "脱敏配置快照", exact: true }).click();
  await expect(page.locator(".asset-code")).toContainText('"CONFIG_NUWAX_OTA_MIN_BATTERY_PERCENT": "5"');
  await page.getByRole("button", { name: "关闭弹窗", exact: true }).click();
  await page.evaluate(() => { location.hash = "#article/handbook-11"; });
  await expect(page.locator(".prose")).toContainText("休眠是一项收尾事务");
  await expect(page.getByRole("button", { name: "notification_playback.h", exact: true })).toBeAttached();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath("handbook-phone.png") });
});
