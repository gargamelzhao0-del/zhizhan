import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { unzipSync } from 'fflate';
import { markdownInventory } from '../scripts/lib/course-fidelity.mjs';
const catalog = JSON.parse(fs.readFileSync('content/textbooks/catalog.json', 'utf8'));
const seed = JSON.parse(fs.readFileSync('public/seed/catalog.json', 'utf8'));

// The source→seed check is scripts/audit-course-completeness.mjs. This second
// layer checks every lesson/guide after the actual React reader has rendered it.
test('all books and project routes preserve every article in the reader', async ({ page }) => {
    test.setTimeout(240000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const book of [...catalog.books, { id: 'Projects and learning routes', chapters: catalog.auxiliary }]) {
    for (const chapter of [...book.chapters, ...(book.guide ? [book.guide] : [])]) {
      const article = seed.articles.find(a => a.id === chapter.id)!;
      const expected = markdownInventory(article.body);
      await page.goto(`/#article/${chapter.id}`);
      await expect(page.locator('.reading-paper>h1')).toHaveText(article.title);
      await expect(page.locator('.reading-paper .prose').first()).toBeAttached();
      const expand = page.getByRole('button', { name: '展开本篇全部折叠内容', exact: true });
      if (await expand.count()) await expand.click();
      const missing = await page.locator('.reading-paper').evaluate((root, expected) => {
        const norm = (s: string) => s.normalize('NFKC').replace(/\s/g, '');
        const code = [...root.querySelectorAll('.media-code pre code')].map(n => (n.textContent || '').replace(/\r\n/g, '\n').replace(/^\n/, '').trimEnd());
        const figures = [...root.querySelectorAll('.textbook-figure svg')].map(n => norm(n.textContent || ''));
        const tables = [...root.querySelectorAll<HTMLTableElement>('.media-table table')].map(table => JSON.stringify([...table.rows].map(row =>
          [...row.cells].map(cell => ({ text: norm(cell.textContent || ''), rowSpan: cell.rowSpan, colSpan: cell.colSpan })))));
        const text = norm(root.textContent || '');
        const missing = [
          ...expected.fragments.filter((s: string) => norm(s).length >= 4 && !text.includes(norm(s))).map((s: string) => `text: ${s.slice(0, 160)}`),
        ];
        const anchors = new Set([...root.querySelectorAll<HTMLElement>('[data-source-anchor]')].map(n => n.dataset.sourceAnchor));
        for (const anchor of expected.anchors) if (!anchors.has(anchor)) missing.push(`section anchor: ${anchor}`);
        for (const node of root.querySelectorAll<HTMLElement>('.prose p,.prose pre,.prose table,.prose .textbook-figure')) {
          if (node.textContent?.trim() && !node.getClientRects().length) missing.push(`not displayed: ${node.textContent.slice(0, 100)}`);
        }
        for (const [kind, source, actual] of [['code', expected.code, code], ['figure', expected.figures, figures], ['table', expected.tables, tables]] as [string, string[], string[]][]) {
          for (const value of source) { const index = actual.indexOf(value); if (index < 0) missing.push(`${kind}: ${value.slice(0, 120)}`); else actual.splice(index, 1); }
        }
        return missing;
      }, { fragments: expected.fragments, code: expected.code, figures: expected.figures, tables: expected.tables,
        anchors: (chapter.sections || []).map((s: { anchor: string }) => s.anchor) });
      expect(missing, chapter.id).toEqual([]);
    }
    console.log(`${test.info().project.name}: ${book.id} complete`);
  }
  expect(errors).toEqual([]);
});

test('full-content controls reveal answers; long code and tables have no vertical clipping', async ({ page }, info) => {
  await page.goto('/#article/course-b05-m01');
  await page.getByRole('button', { name: '展开本篇全部折叠内容', exact: true }).click();
  await expect(page.locator('.reading-paper details:not([open])')).toHaveCount(0);
  const clipped = await page.locator('.media-code .media-preview, .media-table .media-preview').evaluateAll(nodes =>
    nodes.filter(n => n.scrollHeight > n.clientHeight + 2).map(n => n.textContent?.slice(0, 80)));
  expect(clipped).toEqual([]);
  await page.getByRole('button', { name: '收起本篇全部折叠内容', exact: true }).click();
  await expect(page.locator('.reading-paper details[open]')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('full-content-controls.png') });
});

test('module acceptance opens the full lesson, and the source references are present', async ({ page }) => {
  await page.goto('/#shelf/course-b00');
  const task = page.locator('.textbook-outline details').first();
  await task.locator('summary').click();
  await task.getByRole('link', { name: /阅读本模块完整正文/ }).click();
  await expect(page.locator('.reading-paper>h1')).toHaveText('程序是怎么跑起来的');
  await expect(page.getByRole('link', { name: 'C11 委员会草案 N1570', exact: true })).toBeAttached();
});

test('Linux experiment bundle includes device trees, U-Boot scripts and Yocto recipe', async ({ page }) => {
  await page.goto('/#article/course-b09-guide');
  await page.getByRole('button', { name: /下载实验源码包/ }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存附件', exact: true }).click();
  const download = await pending;
  const files = unzipSync(fs.readFileSync((await download.path())!));
  for (const name of ['board_imx.dts', 'board_mp1.dts', 'board_v3s.dts', 'boot_imx.cmd', 'boot_mp1.cmd', 'boot_v3s.cmd', 'layer_imx.bb'])
    expect(files[`labs/${name}`]?.length, name).toBeGreaterThan(0);
});
