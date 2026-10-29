import { test, expect } from "@playwright/test";

test("four phone destinations preserve courses, projects, notes and search", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "手机导航" });
  await expect(nav.getByRole("button")).toHaveText([
    "学习",
    "资料库",
    "复习",
    "我的",
  ]);
  await expect(page.getByRole("region", { name: "继续学习" })).toBeVisible();
  await nav.getByRole("button", { name: "资料库" }).click();
  const categories = page.getByRole("group", { name: "资料分类" });
  await categories.getByRole("button", { name: "课程", exact: true }).click();
  await expect(page.locator(".shelf-card")).toHaveCount(2);
  await categories.getByRole("button", { name: "项目", exact: true }).click();
  await expect(page.locator(".shelf-card.project")).toHaveCount(1);
  await categories.getByRole("button", { name: "经验", exact: true }).click();
  await expect(page.locator(".shelf-card.experience")).toHaveCount(1);
  await page.getByRole("button", { name: "打开搜索" }).click();
  await page.getByLabel("搜索全部知识").fill("RAII");
  await expect(page.locator(".article-row").first()).toBeVisible();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(categories).toBeVisible();
  await nav.getByRole("button", { name: "复习", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "复习清单", exact: true }),
  ).toBeVisible();
  await nav.getByRole("button", { name: "我的", exact: true }).click();
  await expect(page.getByRole("heading", { name: "设置与资料" })).toBeVisible();
});

test("reading size is adjustable in context and continue resumes the article", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#article/cpp-19");
  await page.getByRole("button", { name: "阅读字号", exact: true }).click();
  await page
    .getByRole("combobox", { name: "阅读字号", exact: true })
    .selectOption("20");
  await expect(page.locator(".prose")).toHaveCSS("font-size", "20px");
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 3000));
  await expect(
    page.getByRole("button", { name: /跳到上次阅读位置/ }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "展开阅读导航" }).click();
  await page
    .getByRole("navigation", { name: "手机导航" })
    .getByRole("button", { name: "学习", exact: true })
    .click();
  await expect(page.getByRole("region", { name: "继续学习" })).toContainText(
    "可维护工程",
  );
  await page.getByRole("button", { name: "继续阅读", exact: true }).click();
  await expect(page).toHaveURL(/article\/cpp-19\?resume=1/);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(1000);
  await page.goto("/#settings");
  await expect(page.getByLabel("正文字号", { exact: true })).toHaveValue("20");
});

test("course content reaches the first screen and additions remain accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/#shelf/cpp");
  const first = page.locator(".course-module[open] li a").first();
  await expect(first).toBeVisible();
  const box = await first.boundingBox();
  expect(box!.y + box!.height).toBeLessThan(710);
  await page.getByRole("button", { name: "添加课程内容", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "记录新知识" })).toBeVisible();
  await page.getByRole("button", { name: "关闭弹窗" }).click();
  await page.getByRole("button", { name: "全部章节", exact: true }).click();
  await expect(page.locator(".article-row")).toHaveCount(20);
});
