import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { fromMarkdown } from "mdast-util-from-markdown";

test("book library shows all reviewed books, navigates and fits phones", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#courses");
  await expect(
    page.getByRole("heading", { name: "从基础，走向系统。" }),
  ).toBeVisible();
  await expect(page.locator(".textbook-card")).toHaveCount(27);
  await page.getByLabel("只看有正文").check();
  await expect(page.locator(".textbook-card")).toHaveCount(27);
  await page.screenshot({
    path: info.outputPath("books.png"),
    fullPage: false,
  });
  await page.getByLabel("只看有正文").uncheck();
  await page.getByLabel("查找课本").fill("B10");
  await page.locator(".textbook-card").click();
  await expect(page.locator(".textbook-book-head")).toContainText("正文与实践");
  await expect(
    page.getByRole("link", { name: "阅读原版整册", exact: true }),
  ).toHaveCount(1);
  await page.goto("/#shelf/course-b00");
  await expect(page.locator(".textbook-chapters>a")).toHaveCount(14);
  await page.locator('.textbook-chapters a[href="#article/course-b00-m01"]').click();
  await expect(page.locator(".reading-paper>h1")).toHaveText(
    "程序是怎么跑起来的",
  );
  await expect(
    page.locator(".textbook-figure .textbook-figure-scroll svg").first(),
  ).toBeVisible();
  await expect(
    page
      .locator(".textbook-figure .textbook-figure-scroll svg")
      .first()
      .locator(".sv-arrow")
      .first(),
  ).toHaveAttribute("marker-end", /url\(#fig-/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.locator(".textbook-figure").first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("book-figure.png") });
});

test("native PI experiment remains interactive offline and handles fault latch", async ({
  page,
  context,
}, info) => {
  await page.goto("/#article/course-b23-b23-m13");
  const demo = page.locator(".thermal-demo");
  await expect(demo).toBeVisible();
  await context.setOffline(true);
  await page.getByLabel("实验场景").selectOption("sensor-fault");
  await expect(demo).toContainText("已锁存，输出为零");
  await page.getByLabel("实验场景").selectOption("recovery");
  const metrics = demo.locator(".thermal-metrics");
  const initial = await metrics.textContent();
  await page.getByLabel("启用抗积分饱和").uncheck();
  await expect(metrics).not.toHaveText(initial!);
  await demo.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("pi-experiment.png") });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});

test("SVG sanitizer removes active content and remote resources, keeps unique local markers", async ({
  page,
}) => {
  await page.goto("/#courses");
  const result = await page.evaluate(async () => {
    // Exercise the real browser SVG implementation; no mock DOM or network is needed.
    const { safeTextbookSvg } = await import("/src/TextbookFigure.tsx");
    return safeTextbookSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><script>alert(1)</script><foreignObject><div>unsafe</div></foreignObject><image href="https://example.com/private"/><rect id="box" onclick="alert(1)" style="fill:url(https://example.com/image)"/><path marker-end="url(#ah)"/><text>diagram</text></svg>',
      "test-",
    );
  });
  expect(result).not.toMatch(/script|foreignObject|https:|onclick|<image/);
  expect(result).toContain('id="test-box"');
  expect(result).toContain("url(#test-ah)");
});

test("all textbook figures survive sanitizing with local references intact", async ({
  page,
}) => {
  const seed = JSON.parse(fs.readFileSync("public/seed/catalog.json", "utf8"));
  const figures: {id:string;source:string}[]=[];
  function collect(body:string,id:string) {
    function walk(n:any) {
      if(n.type==='code'&&n.lang==='zhizhan-figure')figures.push({id,source:n.value});
      if(n.type==='code'&&['zhizhan-details','zhizhan-table'].includes(n.lang)) {
        const data=JSON.parse(n.value);
        for(const child of n.lang==='zhizhan-details'?[data.body]:data.rows.flat().map((c:any)=>c.body))collect(child,id);
      }
      n.children?.forEach(walk);
    }
    walk(fromMarkdown(body));
  }
  seed.articles.filter((a:{id:string})=>a.id.startsWith('course-')).forEach((a:{id:string;body:string})=>collect(a.body,a.id));
  expect(figures).toHaveLength(618);
  await page.goto("/#courses");
  const errors = await page.evaluate(
    async (figures: { id: string; source: string }[]) => {
      const { safeTextbookSvg } = await import("/src/TextbookFigure.tsx");
      return figures.flatMap((f, i) => {
        const svg = safeTextbookSvg(f.source, `audit-${i}-`);
        if (!svg) return [`${f.id}: SVG failed to parse`];
        const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
        const ids = new Set(
          [...doc.querySelectorAll("[id]")].map((el) => el.id),
        );
        const missing = [...svg.matchAll(/url\(#([\w-]+)\)/g)]
          .filter((m) => !ids.has(m[1]))
          .map((m) => `${f.id}: missing ${m[1]}`);
        return missing;
      });
    },
    figures,
  );
  expect(errors).toEqual([]);
});

test("dark library and long technical chapters fit 320px and keep diagrams after opening the glossary", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#settings");
  await page.getByRole("button", { name: "深色", exact: true }).click();
  await page.goto("/#shelf/course-b05");
  await expect(page.locator(".textbook-chapters>a")).toHaveCount(25);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({ path: info.outputPath("book-dark-320.png") });
  await page.goto("/#article/course-b01-ch6");
  await expect(
    page.locator(".textbook-figure .textbook-figure-scroll svg").first(),
  ).toBeAttached();
  const figure = page
    .locator(".textbook-figure .textbook-figure-scroll svg")
    .first();
  await figure.evaluate((el) => el.setAttribute("data-instance", "retained"));
  await page.locator(".term-link").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "关闭弹窗" }).click();
  await expect(figure).toHaveAttribute("data-instance", "retained");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});
