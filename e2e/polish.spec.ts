import { test, expect, type Locator } from "@playwright/test";

async function expectSelectionAligned(group: Locator) {
  await expect
    .poll(() =>
      group.evaluate((el) => {
        const selected = el
          .querySelector('[aria-current="page"], [aria-pressed="true"]')!
          .getBoundingClientRect();
        const lens = el
          .querySelector(".selection-lens")!
          .getBoundingClientRect();
        return Math.max(
          Math.abs(lens.x - selected.x),
          Math.abs(lens.y - selected.y),
          Math.abs(lens.width - selected.width),
          Math.abs(lens.height - selected.height),
        );
      }),
    )
    .toBeLessThan(2);
}

test("selection tracks rapid navigation, category changes and orientation without blocking input", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "手机导航" });
  await expectSelectionAligned(nav);
  await nav.evaluate((el) => {
    const buttons = el.querySelectorAll("button");
    [1, 3, 2, 0, 1].forEach((i) => buttons[i].click());
  });
  await expect(page).toHaveURL(/#library$/);
  await expectSelectionAligned(nav);
  const filter = page.getByRole("group", { name: "资料分类" });
  await filter.getByRole("button", { name: "课程", exact: true }).click();
  await expect(page.locator(".shelf-card")).toHaveCount(2);
  await expectSelectionAligned(filter);
  await page.setViewportSize({ width: 800, height: 360 });
  await expectSelectionAligned(nav);
  await expectSelectionAligned(filter);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.getAnimations().filter((a) => a.playState === "running")
            .length,
      ),
    )
    .toBe(0);
});

test("turning reduced motion on cancels an active transition and keeps navigation functional", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "学习", exact: true }),
  ).toBeVisible();
  await page
    .locator(".bottom-nav button")
    .nth(1)
    .evaluate((el: HTMLButtonElement) => el.click());
  await page.waitForFunction(() =>
    document
      .querySelector("main")!
      .getAnimations()
      .some((a) => a.playState === "running"),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.getAnimations().filter((a) => a.playState === "running")
            .length,
      ),
    )
    .toBe(0);
  await page.getByRole("button", { name: "记录新知识", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden",
  );
  await expectSelectionAligned(
    page.getByRole("navigation", { name: "手机导航" }),
  );
});

test("favorite feedback persists and high contrast replaces translucent navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/#article/cpp-01");
  const favorite = page.getByRole("button", { name: "切换收藏", exact: true });
  await expect(favorite).toHaveAttribute("aria-pressed", "false");
  await favorite.click();
  await expect(favorite).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(favorite).toHaveAttribute("aria-pressed", "true");
  await page.emulateMedia({ contrast: "more", reducedMotion: "reduce" });
  const nav = page.getByRole("navigation", { name: "手机导航" });
  await expect(nav).toHaveCSS("backdrop-filter", "none");
  await expect(nav.locator(".glass-material")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await page.getByRole("button", { name: "展开阅读导航" }).click();
  await expectSelectionAligned(nav);
  await nav.getByRole("button", { name: "学习", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "学习", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 240));
  await expect(page.locator("html")).toHaveAttribute("data-scrolled", "true");
  await expect(page.locator(".topbar")).toHaveCSS("backdrop-filter", "none");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});
