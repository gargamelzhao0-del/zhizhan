import { test, expect } from "@playwright/test";

test("course view separates staged learning from the full chapter list", async ({
  page,
}) => {
  await page.goto("/#shelf/cpp");
  const path = page.getByRole("region", { name: "分阶段学习路径" });
  await expect(path).toBeVisible();
  await expect(page.locator(".article-list")).toHaveCount(0);
  await page.getByRole("button", { name: "全部章节", exact: true }).click();
  await expect(path).toHaveCount(0);
  await expect(page.locator(".article-row")).toHaveCount(20);
  await page.getByRole("button", { name: "尚未读完", exact: true }).click();
  await page.getByRole("button", { name: "学习路径", exact: true }).click();
  await expect(path.getByRole("link", { name: "开始学习" })).toHaveAttribute(
    "href",
    "#article/cpp-12",
  );
  await path.locator(".course-goals summary").click();
  await expect(path.locator(".course-goals p").last()).toBeVisible();
  await page.goto("/#shelf/linux");
  await expect(
    page.getByRole("button", { name: "学习路径", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("phone reading, controls and short landscape dialogs remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#settings");
  await page.getByLabel("正文字号", { exact: true }).selectOption("22");
  await expect(page.getByLabel("正文字号预览")).toHaveCSS("font-size", "22px");
  const toggle = page.getByRole("checkbox", { name: "自动检查新版本" });
  const before = await toggle.isChecked();
  await toggle.click();
  await expect(toggle).toBeChecked({ checked: !before });
  await page.goto("/#article/cpp-01");
  await expect(page.locator(".prose")).toHaveCSS("font-size", "22px");
  expect(
    (await page.locator(".prose").boundingBox())!.width,
  ).toBeGreaterThanOrEqual(310);
  for (const button of await page
    .locator(".bottom-nav button,.toolbar-actions button")
    .all()) {
    if (!(await button.isVisible())) continue;
    const box = await button.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
  await page.locator(".reader-section-nav button").nth(1).click();
  await expect(page.getByRole("dialog", {name:"本篇目录"})).toBeVisible();
  await page.locator(".reader-toc button").first().click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 800, height: 360 });
  await page.goto("/#home");
  await expect(
    page.getByRole("navigation", { name: "手机导航" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "记录新知识", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(361);
  await page.getByRole("button", { name: "关闭弹窗" }).click();
  await expect(dialog).toHaveCount(0);
});
