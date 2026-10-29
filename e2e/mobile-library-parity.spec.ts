import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { unzipSync } from 'fflate';

const catalog = JSON.parse(fs.readFileSync('content/textbooks/catalog.json', 'utf8'));
const comparison = JSON.parse(fs.readFileSync('docs/mobile-library-comparison.json', 'utf8'));

test('home course cards keep readable titles at narrow phone widths', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#home');
  const cards = page.locator('.home-courses .textbook-card');
  await expect(cards).toHaveCount(2);
  for (const width of [320, 360, 393, 480, 560, 700, 1000]) {
    await page.setViewportSize({ width, height: 852 });
    await expect(cards.first()).toContainText('14 篇正文 · 12 个模块');
    const dimensions = await cards.evaluateAll(nodes => nodes.map(node => {
      const title = node.querySelector('strong')!;
      const rect = title.getBoundingClientRect();
      return { title: title.textContent, width: rect.width, lines: rect.height / parseFloat(getComputedStyle(title).lineHeight), height: node.getBoundingClientRect().height };
    }));
    for (const d of dimensions) {
      expect(d.width, `${width}px ${d.title}`).toBeGreaterThan(100);
      expect(d.lines, `${width}px ${d.title}`).toBeLessThanOrEqual(3);
      expect(d.height, `${width}px ${d.title}`).toBeLessThan(270);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}px overflow`).toBe(true);
    if (width === 393) {
      await cards.first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath('home-393.png') });
    }
  }
});

test('every mobile book chapter and subsection is reachable from the native directory', async ({ page }) => {
  test.setTimeout(120000);
  for (const source of comparison.books) {
    const book = catalog.books.find((b: { id: string }) => b.id === source.id);
    await page.goto(`/#shelf/${book.shelfId}`);
    await expect(page.locator('.textbook-book-head h1')).toHaveText(book.name);
    await expect(page.locator('.textbook-chapters>a')).toHaveCount(source.mobileChapters);
    const links = await page.locator('.textbook-chapter-sections a').evaluateAll(nodes => nodes.map(n => ({ href: n.getAttribute('href'), title: n.textContent?.trim() })));
    const expected = source.chapters.flatMap((c: { target: string; sections: { anchor: string; title: string }[] }) => c.sections.map(s => ({
      href: `#article/${c.target}?section=${encodeURIComponent(s.anchor)}`, title: s.title.replace(/\s+/g, ' ').trim(),
    })));
    expect(links, source.id).toEqual(expected);
  }
  await page.goto('/#shelf/course-b00');
  const chapter = catalog.books.find((b: { id: string }) => b.id === 'B00').chapters.find((c: { anchor: string }) => c.anchor === 'm01');
  const section = chapter.sections[0];
  const link = page.locator(`a[href="#article/${chapter.id}?section=${encodeURIComponent(section.anchor)}"]`);
  await link.locator('..').locator('summary').click();
  await link.click();
  await expect(page.locator('.reading-paper>h1')).toHaveText(chapter.title);
  const anchor = page.locator(`[data-source-anchor="${section.anchor}"]`);
  await expect(anchor).toBeAttached();
  await expect.poll(async () => anchor.evaluate(node => {
    const y = node.getBoundingClientRect().top; return y >= 0 && y < innerHeight;
  })).toBe(true);
});

test('B01 downloads the same complete starter firmware as its mobile library bundle', async ({ page }) => {
  await page.goto('/#article/course-b01-guide');
  await page.getByRole('button', { name: /下载实验源码包/ }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存附件', exact: true }).click();
  const download = await pending;
  const files = unzipSync(fs.readFileSync((await download.path())!));
  const source = unzipSync(fs.readFileSync('C:/Users/Administrator/Documents/work/手机端书库/resources/B01-labs.zip'));
  for (const [name, bytes] of Object.entries(source)) expect(files[name.replace(/^B01\//, '')], name).toEqual(bytes);
  // Retain the original C probes in addition to the newly accessible firmware.
  expect(Object.keys(files).filter(key => key.startsWith('tools/src/'))).toHaveLength(13);
});
