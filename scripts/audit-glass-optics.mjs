// Verify rendered pixels, not just support syntax or computed CSS values.
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
const {version}=JSON.parse(await fs.readFile('package.json','utf8'));
const directory=`release/previews/${version}`;
await fs.mkdir(directory,{recursive:true});
try {
  const page=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  await page.goto('http://127.0.0.1:8462/#home');
  const glass=page.locator('.bottom-nav > .glass-material');
  await expect(glass).toHaveAttribute('data-glass-phase','still');
  await page.evaluate(()=>{
    const grid=document.createElement('div');grid.id='optical-test-grid';
    grid.style.cssText='position:fixed;z-index:29;bottom:0;left:0;width:100%;height:100px;background:repeating-linear-gradient(90deg,#1269bf 0 3px,#f8be58 3px 6px);pointer-events:none';
    document.body.append(grid);
  });
  const clip=await glass.boundingBox();
  const capture=()=>page.screenshot({clip});
  const baseline=await capture(),stable=await capture();
  assert(baseline.equals(stable),'Fixture pixels must be stable before checking optics');
  await glass.locator('feDisplacementMap').evaluate(el=>el.setAttribute('scale','0'));
  const flat=await capture();
  assert(!baseline.equals(flat),'Changing refraction must change rendered backdrop pixels');
  await glass.locator('feDisplacementMap').evaluate(el=>el.setAttribute('scale','8'));
  await glass.locator('feGaussianBlur[result="soft"]').evaluate(el=>el.setAttribute('stdDeviation','0'));
  const clear=await capture();
  assert(!baseline.equals(clear),'Backdrop diffusion must change rendered backdrop pixels');
  await glass.locator('feGaussianBlur[result="soft"]').evaluate(el=>el.setAttribute('stdDeviation','3.5'));
  await page.evaluate(()=>document.getElementById('optical-test-grid').remove());
  await page.screenshot({path:`${directory}/home-expanded.png`});
  await page.goto('http://127.0.0.1:8462/#article/cpp-19');
  await expect(page.locator('.prose')).toBeVisible();
  await page.evaluate(()=>scrollTo(0,620));
  await expect(page.locator('html')).toHaveAttribute('data-chrome','compact');
  await page.getByRole('button',{name:'展开阅读导航'}).click();
  await expect.poll(()=>glass.locator('feImage').getAttribute('height')).toBe('34');
  await page.screenshot({path:`${directory}/reading-compact.png`});
  const report={version,passed:true,stableFixture:true,refractionChangesRenderedPixels:true,backdropDiffusionChangesRenderedPixels:true,androidDeviceTested:false};
  await fs.writeFile('docs/glass-optics-audit.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
