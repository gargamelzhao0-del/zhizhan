import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
const metadata=JSON.parse(await fs.readFile('package.json','utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true});
const issues=[],pages=[],errors=[];
const routes=['home','library','courses','projects','shelf/cpp','article/cpp-19','settings','review'];
const directory=`release/previews/${metadata.version}`;
await fs.mkdir(directory,{recursive:true});
try{
  for(const [width,height] of [[320,740],[360,780],[393,852],[430,932],[800,360],[1024,768],[1440,1050]]){
    const context=await browser.newContext({viewport:{width,height},isMobile:width<1000,hasTouch:width<1000,reducedMotion:'reduce'});
    const page=await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    for(const theme of ['light','dark']){
      await page.goto('http://127.0.0.1:8462/#settings');
      await page.getByRole('button',{name:theme==='light'?'浅色':'深色',exact:true}).click();
      await page.getByLabel('正文字号',{exact:true}).selectOption(width===320?'22':'18');
      for(const route of routes){
        await page.goto('http://127.0.0.1:8462/#'+route);
        await expect(page.locator('main h1').first()).toBeVisible();
        if(width<760 || (width<1000 && height<=500)) {
          const material=page.locator('.bottom-nav > .glass-material');
          await expect(material).toHaveAttribute('data-optics','ready');
        }
        const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
        if(dimensions.scroll>width+1)issues.push({width,height,theme,route,reason:'horizontal overflow',...dimensions});
        if(width<760){
          for(const button of await page.locator('.bottom-nav button,.settings-mobile,.toolbar-actions button').all()){
            if(!await button.isVisible())continue;
            const box=await button.boundingBox();
            if(box.width<48 || box.height<48)issues.push({width,height,theme,route,reason:'touch target below 48 CSS px',box});
          }
        }
        pages.push({width,height,theme,route,overflow:dimensions.scroll>width+1});
        if((width===393||width===360||width===1440)&&theme==='light'||width===393&&theme==='dark'){
          await page.screenshot({path:`${directory}/${width}-${theme}-${route.replaceAll('/','-')}.png`});
        }
      }
    }
    await context.close();
  }
  const result={version:metadata.version,passed:!issues.length&&!errors.length,pages,issues,pageErrors:errors,androidDeviceTested:false,note:'CSS viewport and touch-target audit in Chromium; actual Samsung insets, keyboard and system font scaling require a phone.'};
  await fs.writeFile('docs/mobile-design-audit.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify({passed:result.passed,pages:pages.length,issues,pageErrors:errors}));
  if(!result.passed)process.exitCode=1;
}finally{await browser.close();}
