import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'parse5';
import { chromium } from '@playwright/test';
const root='C:/Users/Administrator/Documents/work/手机端书库';
const source='C:/Users/Administrator/Documents/嵌入式书库原本';
const output=path.resolve('docs/book-audit-2026-10-13');
await fs.mkdir(output,{recursive:true});
const books=JSON.parse(await fs.readFile(path.join(source,'curriculum.json'),'utf8')).books;
const errors=[],rows=[];
const attr=(n,k)=>n.attrs?.find(a=>a.name===k)?.value;
function walk(n,fn){fn(n);for(const c of n.childNodes||[])walk(c,fn);}
for(const book of books){
  const text=await fs.readFile(path.join(root,'books',book.id+'.html'),'utf8');
  let panels=0,platforms=0,criteria=0;
  walk(parse(text),node=>{
    if(node.tagName==='table'){
      const tableRows=[];
      walk(node,n=>{
        if(n.tagName!=='tr')return;
        let t=n.parentNode;while(t&&t.tagName!=='table')t=t.parentNode;
        if(t===node)tableRows.push(n);
      });
      const future=[];const widths=[];
      for(const tr of tableRows){
        const occupied=future.map(v=>v>0);let col=0;
        for(const cell of (tr.childNodes||[]).filter(n=>n.tagName==='td'||n.tagName==='th')){
          while(occupied[col])col++;
          const span=Number(attr(cell,'colspan')||1),rows=Number(attr(cell,'rowspan')||1);
          for(let j=0;j<span;j++){
            if(occupied[col+j])errors.push(`${book.id}: overlapping table span`);
            occupied[col+j]=true;future[col+j]=rows;
          }
          col+=span;
        }
        const width=occupied.lastIndexOf(true)+1;
        widths.push(width);
        if(occupied.slice(0,width).some(v=>!v))errors.push(`${book.id}: table grid hole`);
        for(let c=0;c<future.length;c++)future[c]=Math.max(0,(future[c]||0)-1);
      }
      if(new Set(widths).size>1)errors.push(`${book.id}: table grid widths ${widths.join('/')}`);
    }
    const id=attr(node,'data-assess');
    if(id){
      panels++;
      let parent=node.parentNode;
      while(parent && !['chapter','reader-chapter'].some(c=>(attr(parent,'class')||'').split(' ').includes(c)))parent=parent.parentNode;
      if(attr(parent||{},'id')!==id)errors.push(`${book.id}: assessment ${id} outside its chapter`);
    }
    if(attr(node,'data-criterion'))criteria++;
    if((attr(node,'class')||'').split(' ').includes('learning-platform'))platforms++;
  });
  if(panels!==book.modules.length||criteria!==panels*3)errors.push(`${book.id}: panel count mismatch`);
  rows.push({book:book.id,modules:book.modules.length,panels,platforms});
}
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:393,height:852}});
const page=await context.newPage();
page.on('pageerror',err=>errors.push(err.message));
try{
  await page.goto('http://127.0.0.1:8080/projects/learning-path.html');
  await page.locator('#learning-journal').fill('自测记录：修改队列容量，保存证据。');
  await page.locator('#save-journal').click();await page.reload();
  if(await page.locator('#learning-journal').inputValue()!=='自测记录：修改队列容量，保存证据。')errors.push('journal persistence');
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  await page.screenshot({path:path.join(output,'learning-path-mobile.png'),fullPage:false});
  await page.goto('http://127.0.0.1:8080/books/B06.html#m09-sdk-project');
  await page.locator('#m09-sdk-project').waitFor({state:'visible'});
  if(await page.locator('#m09-sdk-project').count()!==1)errors.push('SDK section unavailable');
  await page.screenshot({path:path.join(output,'sdk-practice-mobile.png'),fullPage:false});
  for(const name of ['B00','B01','B06','B13','B22']){
    await page.goto(`http://127.0.0.1:8080/books/${name}.html`);
    const sizes=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
    if(sizes.scroll>sizes.width+2)errors.push(`${name}: horizontal page overflow`);
  }
  await page.goto('http://127.0.0.1:8080/projects/quality-review.html#review-B13');
  await page.locator('#review-B13 summary').click();
  await page.screenshot({path:path.join(output,'review-mobile.png'),fullPage:false});
}finally{await browser.close();}
const report={books:rows.length,modules:rows.reduce((s,r)=>s+r.modules,0),
  platformComparisonsCollapsed:rows.reduce((s,r)=>s+r.platforms,0),errors,rows,
  scope:'chapter containment, mobile rendering, learning journal; desktop browser, not physical phone'};
await fs.writeFile(path.join(output,'library-dom-browser-check.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,rows:undefined}));
if(errors.length)process.exitCode=1;
