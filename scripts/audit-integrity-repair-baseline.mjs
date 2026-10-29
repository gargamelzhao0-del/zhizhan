// Compare to the frozen, pre-repair mobile library as well as the rebuilt source.
// Only reviewed text corrections are allowed; rebuilding cannot redefine success.
import fs from 'node:fs/promises';
import path from 'node:path';
import { unzipSync } from 'fflate';
import { mobileDocument, mobileAuxiliary, originalAtoms, orderedMatch, matchMultiset } from './lib/original-library-audit.mjs';
import { sourceInventory, markdownInventory } from './lib/course-fidelity.mjs';
const backup = process.argv[2] || 'backups/integrity-repair-20261013-182615';
const before = unzipSync(await fs.readFile(path.join(backup, 'mobile.zip')));
const oldApp = unzipSync(await fs.readFile(path.join(backup, 'TechVault.zip')));
const decode = bytes => Buffer.from(bytes).toString('utf8');
const manifest = JSON.parse(decode(before['content-version.json']));
const catalog = JSON.parse(await fs.readFile('content/textbooks/catalog.json', 'utf8'));
const seed = JSON.parse(await fs.readFile('public/seed/catalog.json', 'utf8'));
const oldSeed = JSON.parse(decode(oldApp['public/seed/catalog.json']));
const articles = new Map(seed.articles.map(a => [a.id, a]));
function corrected(html) {
  for (const [a, b] of [
    ['include <assert.h>', 'include &lt;assert.h&gt;'], ['Option<T> 表达', 'Option&lt;T&gt; 表达'],
    ['类型变为 Uart<Ready>', '类型变为 Uart&lt;Ready&gt;'], ['Cell<u32> 不是 Sync', 'Cell&lt;u32&gt; 不是 Sync'],
    ['exec<n', 'exec&lt;n'], ['blob <len>', 'blob &lt;len&gt;'], ['fc<Nyquist', 'fc&lt;Nyquist'],
    ['python tools/build_all.py --dry-run', 'python tools/probes/m05_src/build_all.py --dry-run'],
    ['tools/env.sh', 'labs/env.sh'],
    ['blob 名 = SHA1(&quot;blob \\0&quot;+内容)', 'blob 名 = SHA1(&quot;blob &lt;len&gt;\\0&quot;+内容)'],
    ['<svg viewBox="0 0 660 290" width="660" height="290" role="img" aria-label="指针类型的解释差异">', '<svg viewBox="0 0 660 308" width="660" height="308" role="img" aria-label="指针类型的解释差异">'],
  ]) html = html.replaceAll(a, b);
  return html.replace(/<svg\b[\s\S]*?<\/svg>/g, svg => {
    for (const [tag, style] of [['strong','font-weight="700"'],['em','font-style="italic"'],['code','style="font-family:var(--mono)"']])
      svg = svg.replace(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'g'), (_, text) => `<tspan ${style}>${text}</tspan>`);
    return svg;
  });
}
const checks = [], bundleChecks = [];
function check(book, id, node) {
  const article = articles.get(id);
  if (!article) throw Error(`Lost original article: ${id}`);
  const expected = sourceInventory([node]), atoms = originalAtoms(node);
  const actual = markdownInventory(article.title + '\n\n' + article.body);
  const ordered = orderedMatch(atoms.atoms, actual.text);
  const blocks = Object.fromEntries(['code','figureDrawings','tables'].map(k => [k, matchMultiset(expected[k], actual[k])]));
  checks.push({ book, id, fragments: ordered.checked, issues: ordered.issues, blocks });
}
for (const entry of manifest.books) {
  const book = catalog.books.find(b => b.id === entry.id);
  const original = mobileDocument(corrected(decode(before[`books/${entry.id}.html`])));
  for (const region of original.regions) {
    const id = region.anchor === 'book-mastery' ? book.overviewId : book.chapters.find(c => c.anchor === region.anchor)?.id;
    check(entry.id, id, region.node);
  }
  const oldZip = unzipSync(before[`resources/${entry.id}-labs.zip`]);
  const newZip = unzipSync(await fs.readFile(`content/examples/textbooks/${book.experimentFile}`));
  for (const [name, bytes] of Object.entries(oldZip)) {
    const key = name.replace(new RegExp(`^${entry.id}/`), '');
    bundleChecks.push({ book: entry.id, file: key, identical: !!newZip[key] && Buffer.from(bytes).equals(Buffer.from(newZip[key])) });
  }
}
for (const [file, id] of [['index','course-projects'],['learning-path','course-learning-path'],['quality-review','course-quality-review']])
  check('共享页面', id, mobileAuxiliary(decode(before[`projects/${file}.html`])));
const identities = oldSeed.articles.map(a => a.id).sort().join('\n') === seed.articles.map(a => a.id).sort().join('\n');
const personal = oldSeed.articles.filter(a => !a.id.startsWith('course-'));
const personalChanges = personal.filter(a => JSON.stringify(a) !== JSON.stringify(articles.get(a.id))).map(a => a.id);
const issues = checks.reduce((n,c) => n + c.issues.length + Object.values(c.blocks).reduce((s,b) => s+b.issues.length,0),0)
  + bundleChecks.filter(c => !c.identical).length + personalChanges.length + Number(!identities);
const report = { checkedAt: new Date().toISOString(), backup, originalMobileVersion: manifest.content_version,
  currentContentVersion: seed.contentVersion, articles: checks.length, originalBundleFiles: bundleChecks.length,
  personalArticles: personal.length, stableIdentities: identities, personalChanges, issues, checks, bundleChecks };
await fs.writeFile('docs/integrity-repair-original-preservation.json', JSON.stringify(report,null,2));
console.log(JSON.stringify({ articles: checks.length, originalBundleFiles: bundleChecks.length, stableIdentities: identities, personalChanges, issues,
  examples: checks.filter(c => c.issues.length || Object.values(c.blocks).some(b=>b.issues.length)).slice(0,4) }));
if (issues) process.exitCode = 1;
