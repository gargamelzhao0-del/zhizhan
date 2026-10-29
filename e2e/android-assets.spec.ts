import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
const shipped=JSON.parse(await fs.readFile('e2e/fixtures/v140-catalog.json','utf8'));
const current=JSON.parse(await fs.readFile('public/seed/catalog.json','utf8'));

test('Capacitor extensionless routing reproduces v1.4 failure and fixed resources recover without data loss',async({page})=>{
  // Mirrors the installed Capacitor WebViewLocalServer HTML5 path rule.
  // Browser simulation is deliberately identified; this is not a device test.
  let htmlFallbacks=0;
  await page.route('**/seed/assets/*',async route=>{
    const last=new URL(route.request().url()).pathname.split('/').pop()!;
    if(!last.includes('.')) {htmlFallbacks++;return route.fulfill({contentType:'text/html',body:'<!doctype html><html>Injected application page</html>'});}
    return route.continue();
  });
  await page.goto('/#article/cpp-02');
  await expect(page.locator('.reading-paper>h1')).toBeVisible();
  await page.getByRole('button',{name:/我的学习笔记/}).click();
  await page.getByLabel('学习笔记').fill('升级必须保留的 S24 笔记');
  await page.getByLabel('学习笔记').blur();
  await page.goto('/#settings');
  await page.route('**/seed/catalog.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(shipped)}));
  await page.getByRole('button',{name:'更新内置资料',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'页面而非附件'})).toBeVisible();
  expect(htmlFallbacks).toBe(1);
  await page.unroute('**/seed/catalog.json');
  await page.getByRole('button',{name:'更新内置资料',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'内置资料已是本版内容'})).toBeVisible();
  expect(htmlFallbacks).toBe(1);
  expect(current.attachments.every((a:{path:string})=>a.path.endsWith('.bin'))).toBe(true);
  await page.goto('/#article/cpp-02');
  await page.getByRole('button',{name:/我的学习笔记/}).click();
  await expect(page.getByLabel('学习笔记')).toHaveValue('升级必须保留的 S24 笔记');
});

test('v1.4 installed content upgrades with edited originals and learning state preserved',async({page})=>{
  await page.goto('/#settings');
  await expect(page.getByRole('heading',{name:'设置与资料'})).toBeVisible();
  await page.evaluate(async(seed)=>{
    const entries:Record<string,any>={};
    for(const a of seed.articles){
      const bytes=new TextEncoder().encode(JSON.stringify({title:a.title,body:a.body,tags:a.tags,shelfId:a.shelfId}));
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
      entries[a.id]={targetId:a.id,sourceHash:hash,installedHash:hash};
    }
    seed.articles.find((a:any)=>a.id==='cpp-01').body='我在旧版修改的生命周期内容';
    Object.assign(seed.articles.find((a:any)=>a.id==='cpp-02'),{note:'从旧版本保留的笔记',favorite:true,progress:100});
    seed.articles.find((a:any)=>a.id==='linux-02').deletedAt=10;
    await new Promise<void>((resolve,reject)=>{
      const request=indexedDB.open('zhizhan-v1');
      request.onerror=()=>reject(request.error);
      request.onsuccess=()=>{
        const database=request.result;
        const tx=database.transaction(['articles','settings','revisions'],'readwrite');
        tx.objectStore('articles').clear();tx.objectStore('settings').clear();tx.objectStore('revisions').clear();
        for(const a of seed.articles)tx.objectStore('articles').put(a);
        tx.objectStore('settings').put({key:'initialized',value:true});
        tx.objectStore('settings').put({key:'builtinContent',value:{version:seed.contentVersion,articles:entries}});
        tx.oncomplete=()=>{database.close();resolve();};
        tx.onabort=()=>{database.close();reject(tx.error);};
      };
    });
  },structuredClone(shipped));
  await page.reload();
  await page.getByRole('button',{name:'更新内置资料',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'内置资料更新完成'})).toBeVisible();
  const read=()=>page.evaluate(()=>new Promise<any[]>((resolve,reject)=>{
    const request=indexedDB.open('zhizhan-v1');
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      const database=request.result,tx=database.transaction('articles');
      const result=tx.objectStore('articles').getAll();
      result.onsuccess=()=>resolve(result.result);result.onerror=()=>reject(result.error);
      tx.oncomplete=()=>database.close();
    };
  }));
  const articles=await read();
  expect(articles).toHaveLength(current.articles.length+1);
  expect(articles.find(a=>a.id==='cpp-01').body).toBe('我在旧版修改的生命周期内容');
  expect(articles.find(a=>a.id==='cpp-02')).toMatchObject({note:'从旧版本保留的笔记',favorite:true,progress:100});
  expect(articles.find(a=>a.id==='linux-02').deletedAt).toBe(10);
  const copy=articles.find(a=>a.title.includes('内置新版'));
  expect(copy.body).toBe(current.articles.find((a:any)=>a.id==='cpp-01').body);
  expect(articles.find(a=>a.id==='cpp-02').body).toBe(current.articles.find((a:any)=>a.id==='cpp-02').body.replaceAll('doc:cpp-01',`doc:${copy.id}`));
  expect(articles.find(a=>a.id==='cpp-00').body).toContain(`doc:${copy.id}`);
  await page.getByRole('button',{name:'更新内置资料',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'内置资料已是本版内容'})).toBeVisible();
  expect(await read()).toHaveLength(current.articles.length+1);
});
