import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';
const source = JSON.parse(await fs.readFile('docs/original-library-render-input.json', 'utf8'));
const catalog = JSON.parse(await fs.readFile('content/textbooks/catalog.json', 'utf8'));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
const page = await context.newPage();
page.setDefaultTimeout(60000);
const errors = [], articles = [], directories = [];
page.on('pageerror', error => errors.push(error.message));
const baseURL = 'http://127.0.0.1:8462';
await fs.mkdir('docs/original-library-rendering', { recursive: true });
try {
  for (const book of catalog.books) {
    await page.goto(`${baseURL}/#shelf/${book.shelfId}`);
    await page.locator('.textbook-chapters').waitFor();
    const hrefs = await page.locator('a[href]').evaluateAll(links => links.map(a => a.getAttribute('href')));
    const expected = [book.overviewId, ...book.chapters.map(c => c.id)];
    const missing = expected.filter(id => !hrefs.some(href => href === `#article/${id}`));
    const sectionMissing = book.chapters.flatMap(c => (c.sections || []).filter(s =>
      !hrefs.some(href => href === `#article/${c.id}?section=${encodeURIComponent(s.anchor)}`))
      .map(s => ({ chapter: c.id, anchor: s.anchor })));
    directories.push({ book: book.id, chapters: book.chapters.length, missing, sectionMissing });
  }
  let lastBook;
  for (const item of source) {
    await page.goto(`${baseURL}/#article/${item.id}`);
    await page.locator('.reading-paper>h1').waitFor();
    const expand = page.getByRole('button', { name: '展开本篇全部折叠内容', exact: true });
    if (await expand.count()) await expand.click();
    const result = await page.locator('.reading-paper').evaluate((root, expected) => {
      const normalize = value => value.normalize('NFKC').replace(/\s/g, '');
      const text = normalize(root.textContent || '');
      let offset = 0;
      const missing = [];
      for (let i = 0; i < expected.fragments.length; i++) {
        const fragment = normalize(expected.fragments[i]);
        if (!fragment) continue;
        const at = text.indexOf(fragment, offset);
        if (at < 0) missing.push({ index: i, kind: text.includes(fragment) ? 'order-or-repetition' : 'missing-text', fragment: expected.fragments[i].slice(0, 240) });
        else offset = at + fragment.length;
      }
      const absent = [...root.querySelectorAll('.prose p,.prose pre,.prose table,.prose .textbook-figure')]
        .filter(n => n.textContent?.trim() && !n.getClientRects().length).map(n => n.textContent.slice(0, 120));
      const clippedMedia = [...root.querySelectorAll('.media-code .media-preview,.media-table .media-preview')]
        .filter(n => n.scrollHeight > n.clientHeight + 2).map(n => n.textContent?.slice(0, 120));
      const anchors = new Set([...root.querySelectorAll('[data-source-anchor]')].map(n => n.getAttribute('data-source-anchor')));
      const missingSvgVariables = [...root.querySelectorAll('.textbook-figure svg')].flatMap(svg =>
        [...new Set([...svg.outerHTML.matchAll(/var\(\s*(--[\w-]+)/g)].map(m=>m[1]))]
          .filter(name=>!getComputedStyle(svg).getPropertyValue(name).trim()).map(name=>({ label:svg.getAttribute('aria-label'), name })));
      return { missing, absent, clippedMedia, missingSvgVariables, missingAnchors: expected.anchors.filter(a => !anchors.has(a)),
        sourceFragments: expected.fragments.length, renderedCharacters: text.length,
        figures: root.querySelectorAll('.textbook-figure svg').length, code: root.querySelectorAll('.media-code pre code').length,
        tables: root.querySelectorAll('.media-table table').length, closedDetails: root.querySelectorAll('details:not([open])').length };
    }, { fragments: item.fragments, anchors: item.anchors });
    articles.push({ book: item.book, id: item.id, ...result });
    if (item.book !== lastBook) {
      console.log(`Production reader: ${item.book}`); lastBook = item.book;
      await fs.writeFile('docs/original-library-rendering/progress.json', JSON.stringify({ checkedAt: new Date().toISOString(), articlesChecked: articles.length, currentBook: item.book }));
    }
    if (['course-b03-m03', 'course-b03-m10'].includes(item.id))
      await page.screenshot({ path: `docs/original-library-rendering/${item.id}-393.png` });
  }
} finally { await browser.close(); }
const report = { checkedAt: new Date().toISOString(), baseURL, viewport: { width: 393, height: 852 }, isolatedBrowserProfile: true,
  source: '用户指定手机端书库的实际 HTML 文本顺序，与当前 8462 发布服务逐篇渲染结果比较。',
  articles, directories, errors };
await fs.writeFile('docs/original-library-rendering/result.json', JSON.stringify(report, null, 2));
const problemArticles = articles.filter(a => a.missing.length || a.absent.length || a.clippedMedia.length || a.missingSvgVariables.length || a.missingAnchors.length || a.closedDetails);
const problemDirectories = directories.filter(d => d.missing.length || d.sectionMissing.length);
console.log(JSON.stringify({ articles: articles.length, problemArticles: problemArticles.map(a => ({ id:a.id, missing:a.missing.slice(0,3), absent:a.absent, clippedMedia:a.clippedMedia, missingSvgVariables:a.missingSvgVariables, missingAnchors:a.missingAnchors, closedDetails:a.closedDetails })), problemDirectories, errors }));
if (problemArticles.length || problemDirectories.length || errors.length) process.exitCode = 1;
