import { test, expect } from '@playwright/test';
import fs from 'node:fs';
const current = JSON.parse(fs.readFileSync('public/seed/catalog.json', 'utf8'));
const previousArticle = JSON.parse(fs.readFileSync('e2e/fixtures/v1150-course-article.json', 'utf8'));

test('the course patch updates the old chapter while retaining notes, completion and self-assessment', async ({ page }) => {
  const previous = { ...current, contentVersion: '2026.10.13.2',
    shelves: current.shelves.filter((s: { id: string }) => s.id === previousArticle.shelfId),
    articles: [previousArticle], attachments: [] };
  await page.route('**/seed/catalog.json', route => route.fulfill({ json: previous }));
  await page.goto('/#article/course-b00-m01');
  const reference = page.getByRole('link', { name: 'C11 委员会草案 N1570', exact: true });
  await expect(page.locator('.reading-paper>h1')).toHaveText('程序是怎么跑起来的');
  await expect(reference).toHaveCount(0);
  await page.getByRole('button', { name: /我的学习笔记/ }).click();
  await page.getByLabel('学习笔记').fill('升级前的笔记：已独立复现编译与链接失败。');
  await expect(page.getByRole('status').filter({ hasText: '笔记已保存' })).toBeVisible();
  const assessment = page.locator('.course-assessment');
  await assessment.locator('summary').click();
  await assessment.getByRole('checkbox').first().check();
  await expect(assessment).toContainText('1 / 3 已记录');
  await page.getByRole('button', { name: '标记已读完', exact: true }).click();
  await page.unroute('**/seed/catalog.json');
  await page.reload();
  // This fixture intentionally has no attachments. Upgrading it performs a
  // complete first import, which has a separate budget from UI interactions.
  await expect(page.locator('.reading-paper>h1')).toHaveText(previousArticle.title, { timeout: 60000 });
  await expect(reference).toBeAttached();
  await expect(page.getByRole('button', { name: '已读完 · 重新学习', exact: true })).toBeAttached();
  await page.getByRole('button', { name: /我的学习笔记/ }).click();
  await expect(page.getByLabel('学习笔记')).toHaveValue('升级前的笔记：已独立复现编译与链接失败。');
  await assessment.locator('summary').click();
  await expect(assessment.getByRole('checkbox').first()).toBeChecked();
});

test('table of contents opens the enclosing folded explanation before jumping', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#article/course-b05-m01');
  await expect(page.locator('.reading-paper>h1')).toBeVisible();
  const target = await page.locator('.reading-paper .course-details :is(h2,h3,h4)').first().getAttribute('id');
  expect(target).toMatch(/^section-\d+$/);
  const index = Number(target!.split('-')[1]);
  await page.locator('.reader-section-nav button').nth(1).click();
  await page.getByRole('dialog').locator('.reader-toc button').nth(index).click();
  await expect(page.locator(`#${target}`)).toBeVisible();
  expect(await page.locator(`#${target}`).evaluate(node => {
    for (let p = node.parentElement; p; p = p.parentElement) if (p instanceof HTMLDetailsElement && !p.open) return false;
    return true;
  })).toBe(true);
});
