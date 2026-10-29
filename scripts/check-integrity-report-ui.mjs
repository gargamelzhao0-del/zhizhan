import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel:'chrome', headless:true });
const results = [], errors = [];
try {
  for (const width of [1440,393]) {
    const page = await browser.newPage({ viewport:{width,height:950} });
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve('docs/library-integrity-repair.html')).href);
    const result = await page.evaluate(()=>({ width:innerWidth, documentWidth:document.documentElement.scrollWidth,
      books:document.querySelectorAll('tbody tr').length, passed:document.querySelectorAll('tbody .pass').length,
      title:document.querySelector('h1')?.textContent }));
    assert.equal(result.books,27); assert.equal(result.passed,27); assert.ok(result.documentWidth <= width+1);
    await page.screenshot({path:`docs/integrity-repair-report-${width}.png`});
    results.push(result); await page.close();
  }
} finally { await browser.close(); }
assert.equal(errors.length,0);
await fs.writeFile('docs/integrity-repair-report-ui.json',JSON.stringify({results,errors},null,2));
console.log(JSON.stringify({results,errors}));
