// Release gate: compare the source manuscripts, named mobile library and app
// independently, including markup damage that DOM-only comparisons can miss.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
const cwd = path.resolve(import.meta.dirname, '..');
const checks = [
  ['byte-identical original mobile books and resources', ['scripts/bundle-original-library.mjs', '--check']],
  ['source and experiment files', ['scripts/audit-course-completeness.mjs']],
  ['mobile book parity', ['scripts/audit-mobile-library.mjs', 'C:/Users/Administrator/Documents/work/手机端书库', 'docs/original-library-audit-baseline.json']],
  ['original HTML and SVG validity', ['scripts/audit-original-markup.mjs']],
  ['all course hyperlinks', ['scripts/audit-original-library-links.mjs']],
];
for (const [label, args] of checks) {
  const result = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0 || result.error) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    throw result.error || Error(`Course integrity gate failed: ${label}`);
  }
  console.log(`PASS: ${label}`);
}
const seed = JSON.parse(await fs.readFile(path.join(cwd, 'public/seed/catalog.json'), 'utf8'));
const svg = seed.articles.filter(a=>a.id.startsWith('course-'))
  .flatMap(a=>[...a.body.matchAll(/```zhizhan-figure\n([\s\S]*?)\n```/g)].map(m=>m[1])).join('\n');
const styles = await Promise.all((await fs.readdir(path.join(cwd,'src'))).filter(name=>name.endsWith('.css'))
  .map(name=>fs.readFile(path.join(cwd,'src',name),'utf8')));
const defined = new Set([...styles.join('\n').matchAll(/(--[\w-]+)\s*:/g)].map(m=>m[1]));
const missing = [...new Set([...svg.matchAll(/var\(\s*(--[\w-]+)/g)].map(m=>m[1]))].filter(name=>!defined.has(name));
if (missing.length) throw Error(`Undefined diagram colors: ${missing.join(', ')}`);
console.log('PASS: diagram CSS variables');
