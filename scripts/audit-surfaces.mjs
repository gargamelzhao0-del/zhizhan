// Every context uses a disposable IndexedDB; never edits the user's browser profile.
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
const {version}=JSON.parse(await fs.readFile('package.json','utf8'));
const before=process.argv.includes('--before');
const directory=`release/previews/${version}/surfaces${before?'-before':''}`;
await fs.mkdir(directory,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const cases=[],issues=[],errors=[];
try {
 for(const [width,height,theme] of [[393,852,'light'],[393,852,'dark'],[360,780,'light'],[1440,1050,'light']]) {
  const context=await browser.newContext({viewport:{width,height},isMobile:width<760,hasTouch:width<760,reducedMotion:'reduce'});
  const page=await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
  const visit=async route=>{await page.goto(`http://127.0.0.1:8462/#${route}`);await page.locator('.app-shell').waitFor();await page.evaluate(()=>document.fonts.ready);};
  await visit('settings');await page.getByRole('button',{name:theme==='dark'?'深色':'浅色',exact:true}).click();
  const capture=async name=>{
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
   if(layout.scroll>width+1)issues.push({width,theme,name,reason:'horizontal overflow',...layout});
   if(!before && name==='library') {
    const card=page.locator('.library-shelves .shelf-card').first();
    const cover=await card.locator('.cover-art').boundingBox(),copy=await card.locator('.shelf-card-copy').boundingBox();
    if(copy.x<cover.x+cover.width)issues.push({width,theme,name,reason:'library cover and copy must share one row'});
   }
   await page.screenshot({path:`${directory}/${width}-${theme}-${name}.png`});
   cases.push({width,height,theme,name,...layout});
  };
  for(const route of ['home','library','courses','projects','experiences','shelf/cpp','shelf/linux','favorites','review','trash','settings','article/cpp-19','article/handbook-14','edit/cpp-19']){
   await visit(route);await capture(route.replaceAll('/','-'));
  }
  await visit('home');await page.getByRole('button',{name:'记录新知识',exact:true}).first().click();await expect(page.getByRole('dialog')).toBeVisible();await capture('new-article');await page.getByRole('button',{name:'关闭弹窗'}).click();
  await visit('library');await page.getByRole('button',{name:'新建知识库',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await capture('new-shelf');await page.getByRole('button',{name:'关闭弹窗'}).click();
  await visit('article/cpp-19');await page.getByRole('button',{name:'版本历史',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await capture('history');await page.getByRole('button',{name:'关闭弹窗'}).click();
  await visit('home');if(width<760)await page.getByRole('button',{name:'打开搜索',exact:true}).click();await page.getByLabel('搜索全部知识').fill('资源');await expect(page.locator('.article-row').first()).toBeVisible();await capture('search');await page.getByLabel('搜索全部知识').fill('绝无此内容abcdefgh');await expect(page.locator('.empty')).toBeVisible();await capture('search-empty');
  await visit('settings');await page.locator('#software-update').scrollIntoViewIfNeeded();await capture('update-settings');
  await page.locator('#backup-settings').scrollIntoViewIfNeeded();await capture('backup-settings');
  await visit('edit/cpp-19');await page.getByRole('button',{name:'预览',exact:true}).click();await capture('editor-preview');
  await visit('article/cpp-19');await page.getByRole('button',{name:'切换收藏',exact:true}).click();await page.getByRole('button',{name:'加入复习',exact:true}).click();
  await page.getByRole('button',{name:/我的学习笔记/}).click();await page.getByLabel('学习笔记',{exact:true}).fill('先明确资源的所有权，再验证失败时能否正确释放。');await page.getByLabel('学习笔记',{exact:true}).blur();await expect(page.locator('.note-panel')).toContainText('笔记已保存');await page.locator('.reading-end').scrollIntoViewIfNeeded();await capture('reading-note');
  await visit('favorites');await capture('favorites-filled');
  await visit('review');await expect(page.locator('.review-item')).toBeVisible();await capture('review-due');
  await page.getByRole('button',{name:'已掌握',exact:true}).click();await expect(page.locator('.upcoming')).toBeVisible();await capture('review-scheduled');
  await visit('article/cpp-19');await page.getByRole('button',{name:'移入回收站',exact:true}).click();await expect(page).toHaveURL(/#shelf\/cpp$/);await visit('trash');await expect(page.locator('.trash-row')).toBeVisible();await capture('trash-filled');
  await context.close();
 }
 const result={version,before,passed:issues.length===0&&errors.length===0,cases,issues,pageErrors:errors,deviceTested:false};
 await fs.writeFile(`docs/surface-audit${before?'-before':''}.json`,JSON.stringify(result,null,2));
 console.log(JSON.stringify({passed:result.passed,cases:cases.length,issues,pageErrors:errors}));
 if(!result.passed)process.exitCode=1;
} finally {await browser.close();}
