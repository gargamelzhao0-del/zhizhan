// Isolated, synthetic library: record real app interactions without touching user storage.
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
const directory = 'release/previews/1.8';
await fs.mkdir(directory, {recursive:true});
const browser = await chromium.launch({channel:'chrome',headless:true});
const context = await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,
  reducedMotion:'no-preference',recordVideo:{dir:'.private/interaction-videos',size:{width:393,height:852}}});
const page = await context.newPage();
const pause = () => page.waitForTimeout(900); // Deliberate viewing interval in a demonstration, not a test wait.
try {
  await page.goto('http://127.0.0.1:8462/');
  await expect(page.getByRole('heading',{name:'学习',exact:true})).toBeVisible();
  await pause();
  await page.locator('.home-courses .shelf-card').first().click(); await pause();
  await page.getByRole('button',{name:'全部章节',exact:true}).click(); await pause();
  await page.getByRole('button',{name:'学习路径',exact:true}).click(); await pause();
  await page.locator('.course-module').first().locator('summary').click(); await pause();
  await page.locator('.course-module').first().locator('summary').click(); await pause();
  const nav=page.getByRole('navigation',{name:'手机导航'});
  await nav.getByRole('button',{name:'资料库',exact:true}).click(); await pause();
  const categories=page.getByRole('group',{name:'资料分类'});
  await categories.getByRole('button',{name:'课程',exact:true}).click(); await pause();
  await categories.getByRole('button',{name:'经验',exact:true}).click(); await pause();
  await page.getByRole('button',{name:'打开搜索'}).click(); await pause();
  await page.getByLabel('搜索全部知识').fill('RAII'); await pause();
  await page.getByRole('button',{name:'取消',exact:true}).click();
  await nav.getByRole('button',{name:'学习',exact:true}).click(); await pause();
  await page.getByRole('button',{name:'记录新知识',exact:true}).click(); await pause();
  await page.getByRole('button',{name:'关闭弹窗'}).click(); await pause();
  await nav.getByRole('button',{name:'我的',exact:true}).click(); await pause();
  await page.getByRole('button',{name:'深色',exact:true}).click(); await pause();
  await nav.getByRole('button',{name:'学习',exact:true}).click(); await pause();
  await page.screenshot({path:`${directory}/393-dark-home-final.png`});
} finally {
  await context.close();
  await page.video()?.saveAs(`${directory}/interaction-preview.webm`);
  await browser.close();
}
console.log(`${directory}/interaction-preview.webm`);
