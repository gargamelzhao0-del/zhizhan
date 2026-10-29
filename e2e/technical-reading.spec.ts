import { test, expect } from "@playwright/test";
import fs from "node:fs";
const catalog = JSON.parse(fs.readFileSync("public/seed/catalog.json", "utf8"));

test("term panel stays legible in dark mode and keeps an advanced demo mounted", async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#settings");
  await page.getByRole("button", { name: "深色", exact: true }).click();
  await page.goto("/#article/handbook-07");
  const demo = page.locator(".learning-demo");
  await demo.getByRole("button", { name: "下一步" }).click();
  const step = await demo.locator(".demo-explanation").textContent();
  const svg = page.locator(".diagram svg").first();
  await expect(svg).toBeAttached();
  await svg.evaluate(el => el.setAttribute("data-instance-check", "retained"));
  await page.locator(".term-link").first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath("technical-dark-320.png") });
  await dialog.getByRole("button", { name: "关闭弹窗" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(demo.locator(".demo-explanation")).toHaveText(step!);
  await expect(svg).toHaveAttribute("data-instance-check", "retained");
});

test("term panel works offline, traps focus, returns to reading and links related concepts", async ({
  page,
  context,
}, info) => {
  await page.goto("/#article/handbook-07");
  await expect(page.locator(".diagram svg").first()).toBeVisible();
  const trigger = page.locator(".term-link").first();
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "在灵珠中" })).toBeVisible();
  await dialog.evaluate((el) =>
    Promise.all(el.getAnimations().map((a) => a.finished.catch(() => {}))),
  );
  await context.setOffline(true);
  const box = await dialog.boundingBox();
  const vp = page.viewportSize()!;
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width);
  expect(box!.height).toBeLessThanOrEqual(vp.height);
  await page.keyboard.press("Shift+Tab");
  expect(
    await dialog.evaluate((el) => el.contains(document.activeElement)),
  ).toBe(true);
  await dialog.locator(".term-related button").first().click();
  await expect(dialog.locator(".term-summary")).not.toBeEmpty();
  await page.screenshot({ path: info.outputPath("technical-term-panel.png") });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByRole("button", { name: "阅读相关章节" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".reading-paper>h1")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});

test("implementation demonstrations advance and reading layout fits a narrow phone", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const id of ["07", "13", "15"]) {
    await page.goto(`/#article/handbook-${id}`);
    await expect(page.locator(".reading-paper>h1")).toContainText(id);
    const demo = page.locator(".learning-demo").last();
    await demo.scrollIntoViewIfNeeded();
    const initial = await demo.locator(".demo-explanation").textContent();
    await demo.getByRole("button", { name: "下一步" }).click();
    await expect(demo.locator(".demo-explanation")).not.toHaveText(initial!);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  }
  await page.screenshot({ path: info.outputPath("technical-demo-phone.png") });
  await page.goto("/#shelf/handbook");
  await page.getByRole("button", { name: "学习路径", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "分阶段学习路径" }),
  ).toContainText("6 个阶段");
});

test("all project chapter diagrams render, with no syntax fallback", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "mobile",
    "One full inventory plus other desktop interaction checks.",
  );
  test.setTimeout(180000);
  for (const a of catalog.articles.filter((a: { id: string }) =>
    a.id.startsWith("handbook-"),
  )) {
    await page.goto(`/#article/${a.id}`);
    const count = [...a.body.matchAll(/```mermaid\r?\n/g)].length;
    await expect(
      page.getByRole("list", { name: "本章知识路径" }),
    ).toBeVisible();
    await expect(page.locator(".diagram svg")).toHaveCount(count);
    await expect(page.locator(".diagram-fallback")).toHaveCount(0);
  }
  await page.goto("/#article/handbook-08");
  await expect(page.getByRole("list", { name: "本章知识路径" })).toBeVisible();
  await page.screenshot({
    path: info.outputPath("technical-opening-phone.png"),
  });
});
