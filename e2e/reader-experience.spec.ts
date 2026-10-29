import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("figure fullscreen fits, zooms, closes with Android back and preserves position", async ({
  page,
}, info) => {
  await page.goto("/#article/book-b00-01");
  const figure = page.locator(".textbook-figure").first();
  await expect(figure.locator(".textbook-figure-scroll svg")).toBeVisible();
  await figure.scrollIntoViewIfNeeded();
  const trigger = figure.getByRole("button", { name: "全屏查看图解" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "图解查看" });
  await expect(dialog).toBeVisible();
  const before = await page.evaluate(() => scrollY);
  await dialog.getByRole("button", { name: "放大图解" }).click();
  await expect(dialog.locator("output")).toHaveText("150%");
  expect(
    await dialog
      .locator(".textbook-figure-scroll svg")
      .first()
      .evaluate((el) => getComputedStyle(el.querySelector(".sv-box")!).fill),
  ).not.toBe("rgb(0, 0, 0)");
  expect(
    await page.evaluate(() =>
      Array.from(document.querySelectorAll("[id]"))
        .map((el) => el.id)
        .filter((id, i, all) => all.indexOf(id) !== i),
    ),
  ).toEqual([]);
  await page.screenshot({ path: info.outputPath("figure-fullscreen.png") });
  expect(
    await page.evaluate(() =>
      window.dispatchEvent(new Event("zhizhan:back", { cancelable: true })),
    ),
  ).toBe(false);
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(Math.abs((await page.evaluate(() => scrollY)) - before)).toBeLessThan(
    3,
  );
  await expect(figure.locator(".textbook-figure-scroll svg")).toBeVisible();
});

test("code and tables retain complete content offline, font and spacing persist", async ({
  page,
  context,
}, info) => {
  await page.goto("/#article/book-b01-07");
  const code = page.locator(".media-code").first();
  await expect(code).toBeAttached();
  const text = await code.locator("code").textContent();
  await code.getByRole("button", { name: "全屏查看代码" }).click();
  await context.setOffline(true);
  let dialog = page.getByRole("dialog");
  await expect(dialog.locator("code")).toHaveText(text!);
  await dialog.getByLabel("自动换行").check();
  await expect(dialog.locator("pre")).toHaveCSS("white-space", "pre-wrap");
  await page.keyboard.press("Tab");
  expect(
    await dialog.evaluate((el) => el.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  const table = page.locator(".media-table").first();
  const cells = await table.locator("th,td").allTextContents();
  await table.getByRole("button", { name: "全屏查看表格" }).click();
  expect(
    await page.getByRole("dialog").locator("th,td").allTextContents(),
  ).toEqual(cells);
  await page.getByRole("button", { name: "关闭阅读面板" }).click();
  await page.getByLabel("阅读字号", { exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("阅读字号", { exact: true })
    .selectOption("36");
  await page.getByLabel("行间距").selectOption("2");
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await page.setViewportSize({ width: 320, height: 740 });
  await expect(page.locator(".reader .prose")).toHaveCSS("font-size", "36px");
  await expect(page.locator(".reader .prose")).toHaveCSS("line-height", "72px");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({ path: info.outputPath("large-text-320.png") });
});

test("chapter sheet jumps to sections, saved position restores independently of maximum progress", async ({
  page,
}, info) => {
  await page.goto("/#article/book-b01-07");
  await expect(page.locator(".reader-section-nav")).toBeVisible();
  await page.screenshot({ path: info.outputPath("reading-opening.png") });
  await page.locator(".reader-section-nav button").nth(1).click();
  const dialog = page.getByRole("dialog", { name: "本篇目录" });
  await expect(dialog).toBeVisible();
  await page.screenshot({ path: info.outputPath("chapter-sheet.png") });
  await dialog.locator(".reader-toc button").nth(4).click();
  await expect(dialog).toHaveCount(0);
  await expect
    .poll(() =>
      page
        .locator("#section-4")
        .evaluate((el) => Math.round(el.getBoundingClientRect().top)),
    )
    .toBe(112);
  // Use an interior paragraph, not a maximum percentage, for the resume assertion.
  const paragraph = page.locator(".prose > p").nth(15);
  await paragraph.evaluate((el) =>
    window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - 80),
  );
  const signature = await paragraph.textContent();
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const { db } = await import("/src/db.ts");
        return (await db.settings.get("reading-position:book-b01-07"))?.value
          ?.signature;
      }),
    )
    .toBe(signature!.replace(/\s+/g, " ").slice(0, 180));
  await page.goto("/#courses");
  await page.goto("/#article/book-b01-07?resume=1");
  await expect
    .poll(() =>
      paragraph.evaluate((el) => Math.round(el.getBoundingClientRect().top)),
    )
    .toBe(80);
});


test("editor preview fullscreen consumes back before editor navigation", async ({page}) => {
  await page.goto("/#article/cpp-08");
  await page.getByLabel("文章更多操作").click();
  await page.getByRole("button", {name:"编辑",exact:true}).click();
  await page.getByRole("button", {name:"预览",exact:true}).click();
  await page.locator(".editor-preview .media-code").first().getByLabel("全屏查看代码").click();
  await expect(page.getByRole("dialog", {name:"代码查看"})).toBeVisible();
  expect(await page.evaluate(() => window.dispatchEvent(new Event("zhizhan:back",{cancelable:true})))).toBe(false);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".editor-preview")).toBeVisible();
  await expect(page).toHaveURL(/#edit\/cpp-08/);
});
