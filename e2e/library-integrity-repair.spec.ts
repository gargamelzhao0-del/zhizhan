import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { unzipSync } from 'fflate';

test('source dependencies remain in the downloadable archives, including hidden Cargo configuration', async () => {
  const required = {
    b01: ['tools/sm_model.js', 'tools/src/sm_event.c', 'tools/src/hsm_history.c', 'verify/src/177__hsm.c'],
    b03: ['tools/cargo-demo/.cargo/config.toml', 'tools/cargo-demo/Cargo.lock', 'tools/cargo-demo/Cargo.toml', 'tools/cargo-demo/memory.x', 'tools/cargo-demo/src/main.rs'],
  };
  const seed = JSON.parse(fs.readFileSync('public/seed/catalog.json', 'utf8'));
  for (const [book, paths] of Object.entries(required)) {
    const attachment = seed.attachments.find((a: { name: string }) => a.name === `${book}-experiments.zip`);
    const archive = unzipSync(fs.readFileSync(`public/seed/${attachment.path}`));
    for (const path of paths) expect(archive[path]?.length, `${book}/${path}`).toBeGreaterThan(0);
    expect(Object.keys(archive).some(path => path.includes('/target/'))).toBe(false);
  }
});

test('all five damaged diagrams render their restored SVG elements', async ({ page }, info) => {
  const figures = [
    { anchor: 'ch3', label: '指针类型的解释差异', nodes: 30 },
    { anchor: 'ch4', label: 'STM32 内存布局：Flash、SRAM 与外设区', nodes: 47 },
    { anchor: 'ch4', label: 'MSP 与 PSP 双栈与 CONTROL.SPSEL', nodes: 21 },
    { anchor: 'ch4', label: 'heap_A.ld 与 heap_C.ld 的 end 位置对比', nodes: 37 },
    { anchor: 'ch6', label: '读改写竞态', nodes: 28 },
  ];
  const catalog = JSON.parse(fs.readFileSync('content/textbooks/catalog.json', 'utf8'));
  for (const [i, spec] of figures.entries()) {
    const chapter = catalog.books.find((b: { id: string }) => b.id === 'B01').chapters.find((c: { anchor: string }) => c.anchor === spec.anchor);
    await page.goto(`/#article/${chapter.id}`);
    await expect(page.locator('.reading-paper>h1')).toBeVisible({ timeout: 60000 });
    const expand = page.getByRole('button', { name: '展开本篇全部折叠内容', exact: true });
    if (await expand.count()) await expand.click();
    const svg = page.locator(`.textbook-figure svg[aria-label="${spec.label}"]`);
    await expect(svg).toBeVisible();
    // The importer also inlines shared arrow-marker definitions. They are not
    // visible drawing nodes and are checked separately by the fidelity audit.
    const elements = svg.locator(':is(rect,text,path,line,g,tspan,polyline,polygon,circle,ellipse):not(defs *)');
    await expect(elements).toHaveCount(spec.nodes);
    expect(await elements.evaluateAll(nodes => nodes.every(n => n.namespaceURI === 'http://www.w3.org/2000/svg'))).toBe(true);
    const missingColors = await svg.evaluate(node => [...new Set([...node.outerHTML.matchAll(/var\(\s*(--[\w-]+)/g)].map(m=>m[1]))]
      .filter(name=>!getComputedStyle(node).getPropertyValue(name).trim()));
    expect(missingColors).toEqual([]);
    await svg.scrollIntoViewIfNeeded();
    await svg.screenshot({ path: info.outputPath(`restored-figure-${i + 1}.png`) });
    const bounds = await svg.evaluate(node => {
      const graphic = node as SVGSVGElement, box = graphic.getBBox(), view = graphic.viewBox.baseVal;
      return { label: graphic.getAttribute('aria-label'), drawing: { x: box.x, y: box.y, width: box.width, height: box.height },
        viewBox: { x: view.x, y: view.y, width: view.width, height: view.height }, overflow: getComputedStyle(graphic).overflow };
    });
    fs.writeFileSync(info.outputPath(`restored-figure-${i + 1}.json`), JSON.stringify(bounds, null, 2));
    expect(bounds.drawing.x).toBeGreaterThanOrEqual(bounds.viewBox.x);
    expect(bounds.drawing.y).toBeGreaterThanOrEqual(bounds.viewBox.y);
    expect(bounds.drawing.x + bounds.drawing.width).toBeLessThanOrEqual(bounds.viewBox.x + bounds.viewBox.width);
    expect(bounds.drawing.y + bounds.drawing.height).toBeLessThanOrEqual(bounds.viewBox.y + bounds.viewBox.height);
  }
});

test('B18 prerequisite links open all six original chapter destinations', async ({ page }) => {
  for (const [from, to] of [['m03','m02'],['m05','m01'],['m05','m03'],['m06','m04'],['m08','m02'],['m08','m07']]) {
    await page.goto(`/#article/course-b18-${from}`);
    await expect(page.locator('.reading-paper>h1')).toBeVisible({ timeout: 60000 });
    const link = page.locator(`.reading-paper blockquote a[href*="course-b18-${to}"]`);
    await expect(link).toHaveCount(1);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`#article/course-b18-${to}`));
    await expect(page.locator(`[data-source-anchor="${to}"]`)).toBeAttached();
  }
});

test('diagram colors used throughout the library resolve in both themes', async ({ page }, info) => {
  const seed = JSON.parse(fs.readFileSync('public/seed/catalog.json', 'utf8'));
  const allSvg = seed.articles.filter((a: { id: string }) => a.id.startsWith('course-'))
    .flatMap((a: { body: string }) => [...a.body.matchAll(/```zhizhan-figure\n([\s\S]*?)\n```/g)].map(m=>m[1])).join('\n');
  const variables = [...new Set([...allSvg.matchAll(/var\(\s*(--[\w-]+)/g)].map(m=>m[1]))];
  await page.goto('/#article/course-b01-ch4');
  await expect(page.locator('.reading-paper>h1')).toBeVisible({ timeout: 60000 });
  const svg = page.locator('.textbook-figure svg[aria-label="STM32 内存布局：Flash、SRAM 与外设区"]');
  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
    const missing = await svg.evaluate((node,names) => names.filter(name=>!getComputedStyle(node).getPropertyValue(name).trim()), variables);
    expect(missing, theme).toEqual([]);
    const fills = await svg.locator('rect[fill*="-d)"]').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).fill));
    expect(fills.length).toBeGreaterThan(0);
    expect(fills.every(fill=>fill !== 'rgb(0, 0, 0)')).toBe(true);
    await svg.screenshot({ path: info.outputPath(`memory-map-${theme}.png`) });
  }
});

test('upgrading 1.15.2 restores Rust type text and retains the existing note and completion', async ({ page }) => {
  test.setTimeout(120000);
  const current = JSON.parse(fs.readFileSync('public/seed/catalog.json', 'utf8'));
  const oldArticle = JSON.parse(fs.readFileSync('e2e/fixtures/v1152-rust-article.json', 'utf8'));
  const previous = { ...current, contentVersion: '2026.10.13.4',
    shelves: current.shelves.filter((s: { id: string }) => s.id === oldArticle.shelfId),
    articles: [oldArticle], attachments: [] };
  await page.route('**/seed/catalog.json', route => route.fulfill({ json: previous }));
  await page.goto(`/#article/${oldArticle.id}`);
  await expect(page.locator('.reading-paper>h1')).toHaveText(oldArticle.title);
  await expect(page.locator('.reading-paper')).not.toContainText('类型变为 Uart<Ready>');
  await page.getByRole('button', { name: /我的学习笔记/ }).click();
  await page.getByLabel('学习笔记').fill('1.15.2 的笔记：检查 UART 的类型状态转换。');
  await expect(page.getByRole('status').filter({ hasText: '笔记已保存' })).toBeVisible();
  await page.getByRole('button', { name: '标记已读完', exact: true }).click();
  await page.unroute('**/seed/catalog.json');
  await page.reload();
  await expect(page.locator('.reading-paper')).toContainText('类型变为 Uart<Ready>', { timeout: 60000 });
  await expect(page.getByRole('button', { name: '已读完 · 重新学习', exact: true })).toBeAttached();
  await page.getByRole('button', { name: /我的学习笔记/ }).click();
  await expect(page.getByLabel('学习笔记')).toHaveValue('1.15.2 的笔记：检查 UART 的类型状态转换。');
});
