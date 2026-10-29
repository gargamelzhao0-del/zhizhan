import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { fromMarkdown } from "mdast-util-from-markdown";
const catalog = JSON.parse(await fs.readFile("public/seed/catalog.json", "utf8"));
const browser = await chromium.launch({ channel: "chrome", headless: true });
const issues = [], pages = [], errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  page.on("pageerror", e => errors.push(e.message));
  for (const article of catalog.articles) {
    const countDiagrams = node => (node.type === 'code' && node.lang === 'mermaid' ? 1 : 0) + (node.children || []).reduce((n, child) => n + countDiagrams(child), 0);
    const expectedDiagrams = countDiagrams(fromMarkdown(article.body));
    await page.goto(`http://127.0.0.1:8462/#article/${article.id}`);
    await expect(page.locator(".reading-paper>h1")).toHaveText(article.title);
    // A heading can render before the diagram effect runs; wait for the source-derived total.
    await expect.poll(async () => await page.locator('.diagram svg,.diagram-fallback').count(), {timeout:45000}).toBe(expectedDiagrams);
    await expect(page.getByText("正在绘制流程图…", { exact: true })).toHaveCount(0, { timeout: 45000 });
    const diagrams = await page.locator(".diagram svg").count();
    const fallback = await page.locator(".diagram-fallback").count();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    if (fallback || overflow) issues.push({ id: article.id, diagramFallback: fallback, horizontalOverflow: overflow });
    pages.push({ id: article.id, expectedDiagrams, diagrams, fallback, overflow });
  }
  await page.goto("http://127.0.0.1:8462/#article/cpp-00");
  await expect(page.locator(".reading-paper>h1")).toContainText("C++ 学习路线");
  await page.screenshot({ path: "release/previews/course-roadmap-mobile.png" });
  await page.goto("http://127.0.0.1:8462/#settings");
  await page.getByRole("heading", { name: "内置学习资料", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: "release/previews/content-settings-mobile.png" });
  await page.goto("http://127.0.0.1:8462/#article/handbook-05");
  await expect(page.locator(".reading-paper>h1")).toBeVisible();
  await page.screenshot({ path: "release/previews/handbook-snapshot-mobile.png" });
  const result = { contentVersion: catalog.contentVersion, pages, issues, pageErrors: errors, passed: !issues.length && !errors.length };
  await fs.writeFile("docs/reading-audit.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ pages: pages.length, diagrams: pages.reduce((n, p) => n + p.diagrams, 0), issues, pageErrors: errors }));
  if (!result.passed) process.exitCode = 1;
} finally { await browser.close(); }
