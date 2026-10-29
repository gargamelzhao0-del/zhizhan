import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
const {version}=JSON.parse(await fs.readFile('package.json','utf8'));
const directory=`release/previews/${version}`;
await fs.mkdir(directory,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const cases=[],errors=[];
try {
  for(const [width,height] of [[320,740],[360,780],[393,852],[430,932],[800,360]]) {
    const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    for(const theme of ['light','dark']) {
      await page.goto('http://127.0.0.1:8462/#settings');
      await page.getByRole('button',{name:theme==='light'?'浅色':'深色',exact:true}).click();
      for(const route of ['home','library','article/cpp-19','article/handbook-14','article/lessons-01']) {
        await page.goto('http://127.0.0.1:8462/#'+route);
        await expect(page.locator('main h1').first()).toBeVisible();
        const before=await page.locator('.topbar-surface').boundingBox();
        const y=await page.evaluate(()=>{const y=Math.min(400,document.documentElement.scrollHeight-innerHeight);scrollTo(0,y);return y;});
        if(y<96) { cases.push({width,height,theme,route,shortDocument:true});continue; }
        await expect(page.locator('html')).toHaveAttribute('data-chrome','compact');
        const nav=page.getByRole('navigation',{name:'手机导航'});
        const reading=route.startsWith('article/');
        if(reading) {
          const orb=page.getByRole('button',{name:'展开阅读导航'});
          await expect(orb).toBeVisible();
          await expect.poll(()=>nav.locator('.glass-material feImage').getAttribute('height')).toBe('36');
          const ball=await nav.locator('.glass-material').boundingBox();
          expect(ball.width).toBe(36);expect(ball.height).toBe(36);
          if(width===393||width===320)await page.screenshot({path:`${directory}/${width}-${theme}-${route.replaceAll('/','-')}-reading-orb.png`});
          await orb.click();
        }
        await expect.poll(()=>nav.locator('.glass-material feImage').getAttribute('height')).toBe('34');
        const top=await page.locator('.topbar-surface').boundingBox(),bottom=await nav.boundingBox();
        expect(top.width).toBeLessThanOrEqual(50);expect(top.height).toBeLessThanOrEqual(52);
        expect(bottom.width).toBeLessThanOrEqual(200);expect(bottom.height).toBeLessThanOrEqual(48);
        const glass=await nav.locator('.glass-material').boundingBox();
        expect(Math.abs(bottom.x+bottom.width/2-width/2)).toBeLessThan(1);
        expect(glass.width).toBeLessThanOrEqual(196);expect(glass.height).toBeLessThanOrEqual(34);
        expect(height-glass.y-glass.height).toBeLessThanOrEqual(9);
        expect(top.y).toBeGreaterThanOrEqual(0);expect(bottom.y+bottom.height).toBeLessThanOrEqual(height);
        for(const button of await page.locator('.bottom-nav button,.search-trigger').all()) {
          if(!await button.isVisible())continue;
          const b=await button.boundingBox();expect(b.width).toBeGreaterThanOrEqual(48);expect(b.height).toBeGreaterThanOrEqual(48);
        }
        expect(await page.evaluate(()=>scrollY)).toBe(y);
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
        cases.push({width,height,theme,route,shortDocument:false,scrollStable:true,readingOrbVerified:reading,topWidth:top.width,bottomWidth:bottom.width,glassWidth:glass.width,glassHeight:glass.height,bottomInset:height-glass.y-glass.height,expandedTopWidth:before.width});
        if(width===393||width===320)await page.screenshot({path:`${directory}/${width}-${theme}-${route.replaceAll('/','-')}-compact.png`});
      }
    }
    await context.close();
  }
  const report={version,passed:errors.length===0,cases,pageErrors:errors,androidKeyboardTested:false,androidDeviceTested:false};
  await fs.writeFile('docs/adaptive-chrome-audit.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({passed:report.passed,cases:cases.length,compactCases:cases.filter(c=>!c.shortDocument).length,pageErrors:errors}));
  if(!report.passed)process.exitCode=1;
} finally { await browser.close(); }
