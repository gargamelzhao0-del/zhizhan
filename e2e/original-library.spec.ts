import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { parse } from 'parse5';
const originals = JSON.parse(fs.readFileSync('content/original-library.json', 'utf8')) as {
  source: string; books: { id: string; shelfId: string; path: string; chapters: { id: string }[] }[];
};
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const plain = (n: any): string => n.nodeName === '#text' ? n.value : (n.childNodes || []).map(plain).join('');
const walk = (n: any, fn: (n: any) => void) => { fn(n); (n.childNodes || []).forEach((c: any) => walk(c, fn)); };

test('all 27 course entries open the original full book with every heading, code block and diagram', async ({ page, context }, info) => {
  test.setTimeout(240000);
  // No internet service is used by the full-book reader.
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const book of originals.books) {
    const source = fs.readFileSync(`${originals.source}/${book.path}`);
    expect(sha(fs.readFileSync(`public/original-library/${book.path}`))).toBe(sha(source));
    const doc = parse(source.toString('utf8')); let main: any;
    walk(doc, n => { if (n.attrs?.some((a: any) => a.name === 'id' && a.value === 'mMain')) main = n; });
    const expected = { headings: [] as string[], code: [] as string[], figures: 0, tables: 0 };
    walk(main, n => {
      if (/^h[1-6]$/.test(n.tagName || '')) expected.headings.push(plain(n));
      if (n.tagName === 'pre') expected.code.push(plain(n));
      if (n.tagName === 'svg') expected.figures++;
      if (n.tagName === 'table') expected.tables++;
    });
    await page.goto(`/#shelf/${book.shelfId}`);
    await page.getByRole('link', { name: '阅读原版整册', exact: true }).click({ timeout: 60000 });
    const frame = page.frameLocator('iframe');
    await expect(frame.locator('#mMain')).toBeVisible();
    // The first part of a large HTML file can be visible before parsing ends.
    await expect(frame.locator('#mChapters')).toBeAttached();
    await expect(page.locator('.original-reader-loading')).toHaveCount(0);
    expect(await frame.locator('#mMain :is(h1,h2,h3,h4,h5,h6)').allTextContents(), book.id).toEqual(expected.headings);
    expect(await frame.locator('#mMain pre').allTextContents(), book.id).toEqual(expected.code);
    await expect(frame.locator('#mMain svg')).toHaveCount(expected.figures);
    await expect(frame.locator('#mMain table')).toHaveCount(expected.tables);
    for (const chapter of book.chapters) await expect(frame.locator(`[id="${chapter.id}"]`)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(await frame.locator('html').evaluate(el => el.scrollWidth <= el.clientWidth + 1), book.id).toBe(true);
    if (page.viewportSize()!.width >= 900) expect(await frame.locator('#mMain').evaluate(el => {
      const drawer = el.ownerDocument.getElementById('mDrawer')!;
      return drawer.getBoundingClientRect().right <= el.getBoundingClientRect().left + 1;
    }), `${book.id}: sidebar must not cover prose`).toBe(true);
    if (book.id === 'B03') await page.screenshot({ path: info.outputPath('rust-original-full-book.png') });
  }
  expect(errors).toEqual([]);
});

test('the original Rust directory reaches the last module, source, glossary and native chapter notes', async ({ page }, info) => {
  await page.goto('/#shelf/course-b03');
  await page.getByRole('link', { name: '阅读原版整册', exact: true }).click({ timeout: 60000 });
  const original = page.frameLocator('iframe');
  if (page.viewportSize()!.width < 900) await original.getByRole('button', { name: '目录', exact: true }).click();
  const module = original.locator('.m-mod[data-id="m10"]');
  await module.locator('.m-nav-t').click();
  await expect(original.locator('#m10')).toBeInViewport();
  await original.getByRole('link', { name: 'labs/dma_contract.rs', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'dma_contract.rs' })).toContainText('struct Transfer');
  await page.getByRole('button', { name: '关闭源码', exact: true }).click();
  await expect(page.getByRole('link', { name: '分章与笔记', exact: true })).toHaveAttribute('href', '#article/course-b03-m10');
  await page.screenshot({ path: info.outputPath('rust-original-last-module.png') });
  await page.getByRole('link', { name: '分章与笔记', exact: true }).click();
  await expect(page.locator('.reading-paper>h1')).toHaveText('异步固件、取消与外设所有权');
});

test('a protected old article does not hide the installed complete edition from the course directory', async ({ page }) => {
  test.setTimeout(120000);
  const current = JSON.parse(fs.readFileSync('public/seed/catalog.json', 'utf8'));
  const old = JSON.parse(fs.readFileSync('e2e/fixtures/v1152-rust-article.json', 'utf8'));
  const previous = { ...current, contentVersion: '2026.10.13.4', articles: [old], attachments: [],
    shelves: current.shelves.filter((s: any) => s.id === old.shelfId) };
  await page.route('**/seed/catalog.json', route => route.fulfill({ json: previous }));
  await page.goto(`/#edit/${old.id}`);
  await page.getByLabel('文章正文', { exact: true }).fill('我的旧版摘要，必须保留。');
  await expect(page.getByText('所有修改已保存', { exact: true })).toBeVisible();
  await page.unroute('**/seed/catalog.json');
  await page.goto('/#shelf/course-b03');
  await page.reload();
  const chapter = page.locator('.textbook-chapters>a').filter({ hasText: '用类型系统编码硬件约束' });
  await expect(chapter).toBeVisible({ timeout: 60000 });
  expect(await chapter.getAttribute('href')).not.toBe(`#article/${old.id}`);
  await chapter.click();
  await expect(page.locator('.reading-paper')).toContainText('类型变为 Uart<Ready>');
  await page.getByRole('button', { name: /下一篇/ }).click();
  await expect(page.locator('.reading-paper>h1')).toHaveText('no_std 与 panic');
  await page.goto(`/#article/${old.id}`);
  await expect(page.locator('.reading-paper')).toContainText('我的旧版摘要，必须保留。');
});
