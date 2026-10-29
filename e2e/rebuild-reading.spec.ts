import { test, expect } from "@playwright/test";

test("rebuild route and feature wiring remain readable on a small phone", async ({ page }, info) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#article/handbook-30");
  await expect(page.locator(".reading-paper>h1")).toContainText("重新做出灵珠");
  const diagram = page.locator(".diagram svg");
  await expect(diagram).toBeVisible();
  await diagram.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath("rebuild-route-phone.png") });
  await page.getByRole("button", { name: "生产音频帧实验", exact: true }).click();
  await expect(page.locator(".asset-code")).toContainText("audio_frame.c");
  await page.getByRole("button", { name: "关闭弹窗", exact: true }).click();
  await page.goto("/#article/handbook-31");
  await expect(page.locator(".reading-paper>h1")).toContainText("功能接线");
  await page.getByRole("heading", { name: "电量与充电提示", exact: true }).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath("feature-wiring-phone.png") });
});
