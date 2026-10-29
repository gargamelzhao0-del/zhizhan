import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
const {version}=JSON.parse(await fs.readFile('package.json','utf8'));
const directory=`release/previews/${version}`;
await fs.mkdir(directory,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,
  recordVideo:{dir:'.private/interaction-videos',size:{width:393,height:852}},reducedMotion:'no-preference'});
const page=await context.newPage();
const pause=()=>page.waitForTimeout(1100); // Viewing interval, not a correctness test.
try {
  await page.goto('http://127.0.0.1:8462/');await expect(page.locator('.continue-card')).toBeVisible();await pause();
  await page.getByRole('navigation',{name:'手机导航'}).getByRole('button',{name:'资料库',exact:true}).click();await pause();
  await page.evaluate(()=>scrollTo({top:420,behavior:'smooth'}));
  await expect(page.locator('html')).toHaveAttribute('data-chrome','compact');await pause();
  await page.screenshot({path:`${directory}/glass-library-compact.png`});
  await page.evaluate(()=>scrollTo({top:180,behavior:'smooth'}));
  await expect(page.locator('html')).toHaveAttribute('data-chrome','compact');await pause();
  await page.evaluate(()=>scrollTo({top:0,behavior:'smooth'}));
  await expect(page.locator('html')).toHaveAttribute('data-chrome','expanded');await pause();
  await page.goto('http://127.0.0.1:8462/#article/cpp-19');await expect(page.locator('.prose')).toBeVisible();await pause();
  await page.screenshot({path:`${directory}/lesson-start-orb.png`});
  await page.evaluate(()=>scrollTo({top:650,behavior:'smooth'}));
  await expect(page.locator('html')).toHaveAttribute('data-chrome','compact');await pause();
  await page.getByRole('button',{name:'展开阅读导航'}).click();await pause();
  await page.screenshot({path:`${directory}/reading-nav-open.png`});
  await page.evaluate(()=>scrollTo({top:450,behavior:'smooth'}));await pause();
  await page.screenshot({path:`${directory}/reading-orb.png`});
  await page.getByRole('button',{name:'打开搜索'}).click();await pause();
  await page.getByLabel('搜索全部知识').fill('RAII');await pause();
  await page.getByRole('button',{name:'取消',exact:true}).click();await pause();
  await page.goto('http://127.0.0.1:8462/#settings');await page.getByRole('button',{name:'深色',exact:true}).click();await pause();
  await page.goto('http://127.0.0.1:8462/#library');await expect(page.locator('.shelf-card').first()).toBeVisible();await pause();
  await page.evaluate(()=>scrollTo({top:420,behavior:'smooth'}));
  await expect(page.locator('html')).toHaveAttribute('data-chrome','compact');await pause();
  await page.screenshot({path:`${directory}/glass-library-dark-compact.png`});
} finally {
  await context.close();await page.video()?.saveAs(`${directory}/adaptive-navigation.webm`);await browser.close();
}
console.log(`${directory}/adaptive-navigation.webm`);
