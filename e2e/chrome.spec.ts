import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
});
const navOf = (page: any) => page.getByRole("navigation", { name: "手机导航" });
const orbOf = (page: any) =>
  page.getByRole("button", { name: "展开阅读导航", exact: true });
async function lesson(page: any) {
  await page.goto("/#article/cpp-19");
  await expect(page.locator(".prose")).toBeVisible();
  await expect(orbOf(page)).toBeVisible();
}

test("ordinary navigation compacts in both directions and expands only at top or on click", async ({
  page,
}) => {
  await page.goto("/#library");
  await expect(page.locator("main h1")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-chrome", "expanded");
  await page.evaluate(() => scrollTo(0, 400));
  await expect(page.locator("html")).toHaveAttribute("data-chrome", "compact");
  await page.evaluate(() => scrollTo(0, 250));
  await expect(page.locator("html")).toHaveAttribute("data-chrome", "compact");
  expect(await page.evaluate(() => scrollY)).toBe(250);
  await navOf(page)
    .getByRole("button", { name: "资料库", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-chrome", "expanded");
  expect(await page.evaluate(() => scrollY)).toBe(250);
  await page.evaluate(() => scrollTo(0, 200));
  await expect(page.locator("html")).toHaveAttribute("data-chrome", "compact");
  await page.evaluate(() => scrollTo(0, 8));
  await expect(page.locator("html")).toHaveAttribute("data-chrome", "compact");
  await page.evaluate(() => scrollTo(0, 0));
  await expect(page.locator("html")).toHaveAttribute("data-chrome", "expanded");
});

test("a lesson starts with a side orb and stays compact even when returning to its top", async ({
  page,
}) => {
  await lesson(page);
  await expect(page.locator("html")).toHaveAttribute("data-chrome", "compact");
  await expect(navOf(page).getByRole("button")).toHaveCount(1);
  await expect
    .poll(async () => {
      const box = (await orbOf(page).boundingBox())!;
      return Math.round(393 - box.x - box.width);
    })
    .toBe(10);
  const orb = (await orbOf(page).boundingBox())!;
  expect(orb.width).toBe(48);
  expect(orb.height).toBe(48);
  expect(393 - orb.x - orb.width).toBeCloseTo(10, 0);
  for (const y of [600, 400, 0]) {
    await page.evaluate((y) => scrollTo(0, y), y);
    await expect(page.locator("html")).toHaveAttribute(
      "data-chrome",
      "compact",
    );
    await expect(orbOf(page)).toBeVisible();
  }
  await expect
    .poll(
      async () => (await page.locator(".topbar-surface").boundingBox())!.width,
    )
    .toBe(48);
});

test("orb opens the compact four destinations; scrolling and outside taps close it", async ({
  page,
}) => {
  await lesson(page);
  await orbOf(page).click();
  const nav = navOf(page);
  await expect(nav.getByRole("button")).toHaveCount(4);
  await expect(page.locator("html")).toHaveAttribute("data-chrome", "compact");
  await expect.poll(async () => (await nav.boundingBox())!.width).toBe(200);
  await expect
    .poll(async () => {
      const b = (await nav.boundingBox())!;
      return Math.abs(b.x + b.width / 2 - 393 / 2);
    })
    .toBeLessThan(1);
  for (const button of await nav.getByRole("button").all()) {
    const bounds = (await button.boundingBox())!;
    expect(bounds.width).toBeGreaterThanOrEqual(48);
    expect(bounds.height).toBe(48);
  }
  await page.evaluate(() => scrollTo(0, 250));
  await expect(orbOf(page)).toBeVisible();
  await orbOf(page).click();
  await page.locator(".prose p").first().click();
  await expect(orbOf(page)).toBeVisible();
  await orbOf(page).click();
  await nav.getByRole("button", { name: "资料库", exact: true }).click();
  await expect(page).toHaveURL(/#library$/);
  await expect(page.locator("html")).toHaveAttribute("data-chrome", "expanded");
});

test("keyboard opening, Escape and native back return to the orb without leaving the lesson", async ({
  page,
}) => {
  await lesson(page);
  await orbOf(page).focus();
  await page.keyboard.press("Enter");
  await expect(
    navOf(page).getByRole("button", { name: "学习", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(orbOf(page)).toBeFocused();
  await page.keyboard.press("Enter");
  expect(
    await page.evaluate(() =>
      window.dispatchEvent(new Event("zhizhan:back", { cancelable: true })),
    ),
  ).toBe(false);
  await expect(orbOf(page)).toBeVisible();
  await expect(page).toHaveURL(/#article\/cpp-19$/);
  await orbOf(page).click();
  await page.evaluate(() => (location.hash = "article/cpp-18"));
  await expect(page).toHaveURL(/#article\/cpp-18$/);
  await expect(orbOf(page)).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/#article\/cpp-19$/);
  await expect(orbOf(page)).toBeVisible();
});

test("search is an explicit temporary expansion and outside dismissal never steals input focus", async ({
  page,
}) => {
  await lesson(page);
  await orbOf(page).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "打开搜索" }).click();
  const input = page.getByLabel("搜索全部知识");
  await expect(input).toBeFocused();
  await input.fill("Linux");
  await expect
    .poll(
      async () => (await page.locator(".topbar-surface").boundingBox())!.width,
    )
    .toBeGreaterThan(300);
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(orbOf(page)).toBeVisible();
  await expect
    .poll(
      async () => (await page.locator(".topbar-surface").boundingBox())!.width,
    )
    .toBe(48);
});

test("keyboard viewport contraction hides the entire reading navigation then restores the orb", async ({
  page,
}) => {
  await lesson(page);
  await page.getByRole("button", { name: "打开搜索" }).click();
  await expect(page.getByLabel("搜索全部知识")).toBeFocused();
  await page.setViewportSize({ width: 393, height: 500 });
  await expect(page.locator("html")).toHaveAttribute("data-keyboard", "true");
  await expect(navOf(page)).toBeHidden();
  await expect(orbOf(page)).toBeHidden();
  await page.setViewportSize({ width: 393, height: 852 });
  await expect(page.locator("html")).toHaveAttribute("data-keyboard", "false");
  await expect(orbOf(page)).toBeVisible();
  await expect(page.getByLabel("搜索全部知识")).toBeFocused();
});

test("orb and compact panel preserve safe area, glass fallback and reading state across rotation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await lesson(page);
  await page.evaluate(() =>
    document.documentElement.style.setProperty("--safe-bottom", "28px"),
  );
  const glass = page.locator(".bottom-nav>.glass-material");
  await expect
    .poll(() => glass.locator("feImage").getAttribute("height"))
    .toBe("36");
  let bounds = (await glass.boundingBox())!;
  expect(bounds.width).toBe(36);
  expect(852 - bounds.y - bounds.height).toBe(35);
  await orbOf(page).click();
  await expect
    .poll(() => glass.locator("feImage").getAttribute("height"))
    .toBe("34");
  bounds = (await glass.boundingBox())!;
  expect(bounds.width).toBe(196);
  expect(852 - bounds.y - bounds.height).toBe(36);
  await page.emulateMedia({ contrast: "more" });
  await expect(glass).toHaveCSS("backdrop-filter", "none");
  await expect(glass).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 800, height: 360 });
  await expect(page.locator("html")).toHaveAttribute("data-chrome", "compact");
  await expect(orbOf(page)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.emulateMedia({ contrast: "no-preference" });
  await expect(glass).toHaveAttribute("data-optics", "ready");
});

for (const article of ["handbook-14", "lessons-01"]) {
  test(`${article} uses the reading orb and returns to ordinary library navigation`, async ({
    page,
  }) => {
    await page.goto(`/#article/${article}`);
    await expect(page.locator(".prose")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-reading", "true");
    await expect(page.locator("html")).toHaveAttribute(
      "data-chrome",
      "compact",
    );
    await expect(orbOf(page)).toBeVisible();
    await expect(navOf(page).getByRole("button")).toHaveCount(1);
    for (const y of [250, 0]) {
      await page.evaluate((y) => scrollTo(0, y), y);
      await expect(page.locator("html")).toHaveAttribute(
        "data-chrome",
        "compact",
      );
      await expect(orbOf(page)).toBeVisible();
    }
    await orbOf(page).click();
    await expect(navOf(page).getByRole("button")).toHaveCount(4);
    await expect
      .poll(async () => {
        const box = (await navOf(page).boundingBox())!;
        return Math.abs(box.x + box.width / 2 - 393 / 2);
      })
      .toBeLessThan(1);
    await expect(
      navOf(page).getByRole("button", { name: "资料库", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await page.keyboard.press("Escape");
    await expect(orbOf(page)).toBeVisible();
    await orbOf(page).click();
    await navOf(page)
      .getByRole("button", { name: "资料库", exact: true })
      .click();
    await expect(page).toHaveURL(/#library$/);
    await expect(page.locator("html")).toHaveAttribute("data-reading", "false");
    await expect(page.locator("html")).toHaveAttribute(
      "data-chrome",
      "expanded",
    );
    await expect(navOf(page).getByRole("button")).toHaveCount(4);
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`#article/${article}$`));
    await expect(orbOf(page)).toBeVisible();
  });
}

test("editor navigation contains its glass without blurring the writing surface", async ({
  page,
}) => {
  await page.goto("/#edit/cpp-19");
  const editor = page.getByLabel("文章正文", { exact: true });
  await expect(editor).toBeVisible();
  const nav = navOf(page),
    glass = nav.locator(":scope > .glass-material");
  await expect(glass).toHaveAttribute("data-glass-phase", "still");
  const n = await nav.boundingBox(),
    g = await glass.boundingBox();
  expect(g!.height).toBeLessThanOrEqual(n!.height + 1);
  expect(g!.width).toBeLessThanOrEqual(n!.width + 1);
  expect(g!.y).toBeGreaterThanOrEqual(n!.y - 1);
  const input = await editor.boundingBox();
  expect(g!.y).toBeGreaterThan(input!.y + input!.height);
  await editor.fill("## 清晰写作\n\n保留正文与自动保存。");
  await page.getByRole("button", { name: "返回阅读", exact: true }).click();
  await expect(page.locator(".prose")).toContainText("保留正文与自动保存");
});

test("opening the orb never creates horizontal overflow during its morph", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await lesson(page);
  const overflow = await page.evaluate(async () => {
    document.querySelector<HTMLButtonElement>(".reading-nav-orb")!.click();
    let maximum = 0;
    for (let frame = 0; frame < 35; frame++) {
      await new Promise(requestAnimationFrame);
      maximum = Math.max(
        maximum,
        document.documentElement.scrollWidth - innerWidth,
      );
    }
    return maximum;
  });
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(navOf(page).getByRole("button")).toHaveCount(4);
});

test("morphing glass uses a live native backdrop instead of stretching a stale SVG map", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await lesson(page);
  const material = page.locator(".bottom-nav>.glass-material");
  await expect(material).toHaveAttribute("data-glass-phase", "still");
  const result = await page.evaluate(async () => {
    const glass = document.querySelector<HTMLElement>(
      ".bottom-nav>.glass-material",
    )!;
    document.querySelector<HTMLButtonElement>(".reading-nav-orb")!.click();
    let moving = 0,
      stale = 0,
      nativeMissing = 0;
    for (let i = 0; i < 28; i++) {
      await new Promise(requestAnimationFrame);
      if (
        glass.dataset.chromeMorphing === "true" ||
        glass.dataset.glassPhase === "moving"
      ) {
        moving++;
        if (
          getComputedStyle(glass.querySelector(".glass-refraction")!)
            .backdropFilter !== "none"
        )
          stale++;
        if (
          !getComputedStyle(
            glass.querySelector(".glass-diffusion")!,
          ).backdropFilter.includes("blur")
        )
          nativeMissing++;
      }
    }
    return { moving, stale, nativeMissing };
  });
  expect(result.moving).toBeGreaterThan(0);
  expect(result.stale).toBe(0);
  expect(result.nativeMissing).toBe(0);
  await expect(material).toHaveAttribute("data-glass-phase", "still");
  await expect(material.locator(".glass-refraction")).toHaveCSS(
    "backdrop-filter",
    /url\(.+glass-/,
  );
});

test("rapid reversals continue from the displayed glass and reduced motion settles immediately", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/#library");
  await expect(page.locator(".shelf-card").first()).toBeVisible();
  await page.waitForTimeout(500);
  await page.evaluate(() => scrollTo(0, 180));
  await expect(page.locator("html")).toHaveAttribute("data-chrome", "compact");
  const jump = await page.evaluate(async () => {
    await new Promise((resolve) => setTimeout(resolve, 65));
    const surfaces = Array.from(
      document.querySelectorAll(
        ".topbar-surface>.glass-material,.bottom-nav>.glass-material",
      ),
    );
    const before = surfaces.map((el) => el.getBoundingClientRect());
    window.dispatchEvent(new Event("zhizhan:reveal-chrome"));
    const after = surfaces.map((el) => el.getBoundingClientRect());
    return Math.max(
      ...before.flatMap((box, i) => [
        Math.abs(box.x - after[i].x),
        Math.abs(box.width - after[i].width),
      ]),
    );
  });
  expect(jump).toBeLessThan(2);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator('[data-chrome-morphing="true"]')).toHaveCount(0);
  await expect(page.locator(".bottom-nav>.glass-material")).toHaveCSS(
    "transform",
    "none",
  );
  await page.evaluate(() => scrollTo(0, 200));
  await expect(page.locator("html")).toHaveAttribute("data-chrome", "compact");
  await expect(page.locator('[data-chrome-morphing="true"]')).toHaveCount(0);
});

test("morphing keeps endpoint layout sizes stable while visual geometry moves", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await lesson(page);
  await page.waitForTimeout(500);
  const result = await page.evaluate(async () => {
    const glass = document.querySelector<HTMLElement>(
      ".bottom-nav>.glass-material",
    )!;
    document.querySelector<HTMLButtonElement>(".reading-nav-orb")!.click();
    const sizes = new Set<string>(),
      visuals = new Set<number>();
    for (let i = 0; i < 24; i++) {
      await new Promise(requestAnimationFrame);
      sizes.add(`${glass.clientWidth}:${glass.clientHeight}`);
      visuals.add(Math.round(glass.getBoundingClientRect().width));
    }
    return { sizes: [...sizes], visuals: visuals.size };
  });
  expect(result.sizes).toEqual(["196:34"]);
  expect(result.visuals).toBeGreaterThan(2);
});
