import { test, expect } from "@playwright/test";

test("rapid navigation cancels old transitions and reduced motion disables movement", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "学习" })).toBeVisible();
  for (const route of [
    "courses",
    "projects",
    "experiences",
    "review",
    "settings",
  ])
    await page.evaluate((route) => {
      location.hash = route;
    }, route);
  await expect(page.getByRole("heading", { name: "设置与资料" })).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator("main")
        .evaluate(
          (el) =>
            el.getAnimations().filter((a) => a.playState === "running").length,
        ),
    )
    .toBe(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => {
    location.hash = "home";
  });
  await expect(page.getByRole("heading", { name: "学习" })).toBeVisible();
  expect(
    await page.locator("main").evaluate((el) => el.getAnimations().length),
  ).toBe(0);
});

test("modal owns focus and scroll, restores both after animated dismissal", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "记录新知识" });
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe(
    "hidden",
  );
  await page.keyboard.press("Shift+Tab");
  expect(
    await page.evaluate(
      () => !!document.activeElement?.closest('[role="dialog"]'),
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden",
  );
  await trigger.click();
  await page.getByRole("button", { name: "关闭弹窗" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("note disclosure preserves text and editor preview restores caret and draft", async ({
  page,
}) => {
  await page.goto("/#article/cpp-08");
  const toggle = page.getByRole("button", { name: /我的学习笔记/ });
  await toggle.click();
  const note = page.getByLabel("学习笔记");
  await note.fill("折叠后仍保留的理解");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(await note.evaluate((el) => !!el.closest("[inert]"))).toBe(true);
  await toggle.click();
  await expect(note).toHaveValue("折叠后仍保留的理解");
  await page.getByLabel("文章更多操作").click();
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  const body = page.getByLabel("文章正文");
  await body.fill("用于验证编辑预览切换。\n\n正文不会重置。");
  await body.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(3, 7));
  await page.getByRole("button", { name: "预览", exact: true }).click();
  await expect(page.locator(".editor-preview")).toContainText("正文不会重置");
  await page.getByRole("button", { name: "继续编辑", exact: true }).click();
  expect(
    await body.evaluate((el: HTMLTextAreaElement) => [
      el.selectionStart,
      el.selectionEnd,
    ]),
  ).toEqual([3, 7]);
  await expect(body).toBeFocused();
  await page.getByRole("button", { name: "返回阅读", exact: true }).click();
  await expect(page.locator(".prose")).toContainText("正文不会重置");
});
