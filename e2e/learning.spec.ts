import { test, expect } from "@playwright/test";

test("course stages lead from fundamentals and interactive models work offline", async ({ page, context }) => {
  await page.goto('/#shelf/cpp');
  const path = page.getByRole('region', { name: '分阶段学习路径' });
  await expect(path.locator('.course-module')).toHaveCount(5);
  await expect(path.getByRole('link', {name:'开始学习'})).toHaveAttribute('href', '#article/cpp-12');
  await page.goto('/#article/linux-09');
  const demo = page.getByRole('figure', {name:'一次接收，不等于一条消息'});
  await expect(demo).toBeVisible();
  await context.setOffline(true);
  await demo.getByRole('button', {name:'下一步'}).click();
  await expect(demo.locator('.byte-stream [data-filled="true"]')).toHaveCount(2);
  await demo.getByRole('button', {name:'下一步'}).click();
  await expect(demo.locator('.byte-stream [data-filled="true"]')).toHaveCount(7);
  await expect(demo.locator('.demo-explanation')).toContainText('不能提前交付');
  await demo.getByRole('button', {name:'下一步'}).click();
  await expect(demo.locator('.byte-stream [data-filled="true"]')).toHaveCount(10);
  await expect(demo.locator('.demo-explanation')).toContainText('完整消息');
  await page.emulateMedia({ reducedMotion:'reduce' });
  await demo.getByRole('button', {name:'播放演示'}).click();
  await expect(demo.locator('.byte-stream [data-filled="true"]')).toHaveCount(0);
  await expect(demo.getByRole('button',{name:'播放演示'})).toHaveAttribute('aria-pressed','false');
});

test("narrow dark reading preserves touch targets and contains diagram overflow", async ({ page }) => {
  await page.setViewportSize({width:320,height:740});
  await page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});
  await page.goto('/#settings');
  await page.getByRole('button',{name:'深色',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.goto('/#article/cpp-08');
  const demo = page.getByRole('figure',{name:'看见所有权的转移'});
  await expect(demo).toBeVisible();
  await page.evaluate(()=>document.documentElement.style.setProperty('--reading-size','22px'));
  await demo.scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  for(const button of await demo.locator('button').all()) {
    const box=await button.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
  }
  await demo.getByRole('button',{name:'播放演示'}).click();
  await expect(demo.locator('.demo-explanation')).toContainText('借用');
  await page.screenshot({path:'release/previews/learning-demo-320.png'});
  await page.getByLabel("文章更多操作").click();
  await page.getByRole('button',{name:'编辑',exact:true}).click();
  await page.getByLabel('文章正文').fill('```zhizhan-demo\nconstructor\n```');
  await page.getByRole('button',{name:'预览',exact:true}).click();
  await expect(page.locator('.editor-preview')).toContainText('此原理演示暂不支持');
});
