import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { attr, walk } from './lib/course-fidelity.mjs';
import { mobileDocument, mobileAuxiliary, originalAtoms, markdownStructure, matchMultiset } from './lib/original-library-audit.mjs';
const root = 'C:/Users/Administrator/Documents/work/手机端书库';
const manifest = JSON.parse(await fs.readFile(root + '/content-version.json', 'utf8'));
const catalog = JSON.parse(await fs.readFile('content/textbooks/catalog.json', 'utf8'));
const seed = JSON.parse(await fs.readFile('public/seed/catalog.json', 'utf8'));
const assets = new Map(seed.attachments.map(a => [a.id, a]));
const articles = new Map(seed.articles.map(a => [a.id, a]));
const roots = new Map(), targets = new Map(), items = [], rootAnchors = new Map();
const key = file => path.resolve(file).replaceAll('\\', '/').toLowerCase();
const hash = data => createHash('sha256').update(data).digest('hex');
for (const entry of manifest.books) {
  const book = catalog.books.find(b => b.id === entry.id), file = path.join(root, 'books', entry.id + '.html');
  const mobile = mobileDocument(await fs.readFile(file, 'utf8'));
  roots.set(key(file), book.overviewId);
  for (const region of mobile.regions) {
    const id = region.anchor === 'book-mastery' ? book.overviewId : book.chapters.find(c => c.anchor === region.anchor).id;
    rootAnchors.set(id, region.anchor);
    walk(region.node, n => { if (attr(n, 'id')) targets.set(key(file) + '#' + attr(n, 'id'), { id, anchor: attr(n, 'id') }); });
    items.push({ book: entry.id, id, file, node: region.node });
  }
}
for (const spec of [{file:'projects/index.html',id:'course-projects'}, {file:'projects/learning-path.html',id:'course-learning-path'}, {file:'projects/quality-review.html',id:'course-quality-review'}]) {
  const file = path.join(root, spec.file), node = mobileAuxiliary(await fs.readFile(file, 'utf8'));
  roots.set(key(file), spec.id);
  walk(node, n => { if (attr(n, 'id')) targets.set(key(file) + '#' + attr(n, 'id'), { id: spec.id, anchor: attr(n, 'id') }); });
  items.push({ book: '共享项目与导读', id: spec.id, file, node });
}
// Root-level copies are the same shared guides as their /projects routes.
roots.set(key(path.join(root, 'learning-path.html')), 'course-learning-path');
roots.set(key(path.join(root, 'quality-review.html')), 'course-quality-review');
const doc = (id, anchor = '') => `doc:${id}` + (anchor && anchor !== rootAnchors.get(id) ? '#' + anchor : '');
function actualIdentity(href) {
  if (href.startsWith('doc:')) { const [id, anchor] = href.slice(4).split('#'); return doc(id, decodeURIComponent(anchor || '')); }
  if (/^(asset|attachment):/.test(href)) { const a = assets.get(href.replace(/^(asset|attachment):/, '')); return a ? 'asset:' + a.sha256 : 'missing:' + href; }
  return href;
}
async function expectedIdentity(href, base) {
  if (/^(?:[a-z]+:|\/\/)/i.test(href)) return href;
  const [rel, anchor] = href.split('#');
  const file = rel ? path.resolve(path.dirname(base), decodeURIComponent(rel.split('?')[0])) : base;
  if (roots.has(key(file))) {
    if (!anchor) return doc(roots.get(key(file)));
    const target = targets.get(key(file) + '#' + decodeURIComponent(anchor));
    return target ? doc(target.id, target.anchor) : 'missing-source-anchor:' + href;
  }
  if (!key(file).startsWith(key(root) + '/')) return 'outside-library:' + href;
  const bytes = await fs.readFile(file).catch(() => null);
  return bytes ? 'asset:' + hash(bytes) : 'missing-source-file:' + href;
}
const results = [];
for (const item of items) {
  const original = originalAtoms(item.node), actual = markdownStructure(articles.get(item.id).body);
  const expected = [];
  for (const link of original.links) expected.push({ ...link, identity: await expectedIdentity(link.href, item.file) });
  const links = matchMultiset(expected, actual.links.map(l => ({ ...l, identity: actualIdentity(l.href) })), l => l.identity);
  const expectedImages = [];
  for (const img of original.images) expectedImages.push({ ...img, identity: await expectedIdentity(img.src, item.file) });
  const images = matchMultiset(expectedImages, actual.images.map(i => ({ ...i, identity: actualIdentity(i.src) })), i => i.identity);
  results.push({ book:item.book, id:item.id, links, images });
}
const report = { checkedAt: new Date().toISOString(), results,
  totals: { links: results.reduce((s,r)=>s+r.links.checked,0), images: results.reduce((s,r)=>s+r.images.checked,0),
    issues: results.reduce((s,r)=>s+r.links.issues.length+r.images.issues.length,0) } };
await fs.writeFile('docs/original-library-link-audit.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ totals:report.totals, examples:results.filter(r=>r.links.issues.length||r.images.issues.length).slice(0,15) }));
if (report.totals.issues) process.exitCode = 1;
