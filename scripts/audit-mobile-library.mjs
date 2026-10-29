import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from 'parse5';
import { unzipSync } from 'fflate';
import { attr, children, walk, plain, normalize, sourceInventory, markdownInventory } from './lib/course-fidelity.mjs';

const mobileRoot = process.argv[2] || 'C:/Users/Administrator/Documents/work/手机端书库';
const output = process.argv[3] || 'docs/mobile-library-comparison.json';
const catalog = JSON.parse(await fs.readFile('content/textbooks/catalog.json', 'utf8'));
const seed = JSON.parse(await fs.readFile('public/seed/catalog.json', 'utf8'));
const manifest = JSON.parse(await fs.readFile(path.join(mobileRoot, 'content-version.json'), 'utf8'));
const articles = new Map(seed.articles.map(a => [a.id, a]));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const hasClass = (n, c) => attr(n, 'class').split(/\s+/).includes(c);
const adaptations = ['手机书库的顶栏、目录、继续阅读、下载提示、结束标记由知栈界面替代；不计入教材正文。',
  '小节入口统计包含 1574 个章节小节。另有 27 个导读标题，通过各册“导读与实验资料”入口访问；导读全文参与内容核对。',
  '代码行号由 CSS 生成；逐行 span 恢复换行后逐字比较。折叠练习、表格、SVG 文字和代码分别核对。',
  '自评和温控交互使用知栈原生组件；本报告不验证实机实验结果。'];

// Read the generated mobile pages, not their authoring directory. The mobile
// manifest defines the required chapters independently of the destination.
function mobileRegions(html) {
  const doc = parse(html), ids = new Map(); let main, chapterList;
  walk(doc, n => { if (attr(n, 'id')) ids.set(attr(n, 'id'), n); if (attr(n, 'id') === 'mMain') main = n; });
  chapterList = JSON.parse(plain(ids.get('mChapters')));
  if (!main) throw Error('Mobile book main is missing');
  function clean(n) {
    if (attr(n, 'id') === 'mResume' || hasClass(n, 'm-resource-panel') || hasClass(n, 'm-theend')) return null;
    // The mobile build adds this toolbar around bare pre elements.
    if (hasClass(n, 'code-bar') && hasClass(n.parentNode || {}, 'm-code')) return null;
    // Numbered code lines are block elements in the mobile stylesheet.
    if (n.tagName === 'pre') {
      const lines = []; walk(n, c => { if (hasClass(c, 'ln')) lines.push(plain(c)); });
      if (lines.length) return { ...n, childNodes: [{ nodeName: '#text', value: lines.join('\n') }] };
    }
    return { ...n, childNodes: children(n).map(clean).filter(Boolean) };
  }
  const regions = chapterList.filter(c => c.id !== 'book-mastery').map(c => {
    if (!ids.has(c.id)) throw Error(`Mobile chapter ${c.id} is missing`);
    const navigation = [];
    walk(doc, n => {
      if (hasClass(n, 'm-mod') && attr(n, 'data-id') === c.id) walk(n, link => {
        if (hasClass(link, 'm-sec')) navigation.push({ anchor: attr(link, 'href').replace(/^#/, ''), title: plain(link).trim() });
      });
    });
    return { anchor: c.id, title: c.title, navigation, nodes: [clean(ids.get(c.id))] };
  });
  const chapterNodes = new Set(regions.map(c => ids.get(c.anchor)));
  function overview(n) {
    if (chapterNodes.has(n)) return null;
    const result = clean(n);
    if (result) result.childNodes = children(n).map(overview).filter(Boolean);
    return result;
  }
  regions.push({ anchor: 'book-mastery', title: '导读、学习路径与参考', navigation: [], nodes: [overview(main)] });
  return regions;
}

function compare(nodes, article) {
  const expected = sourceInventory(nodes), actual = article && markdownInventory(article.title + '\n\n' + article.body);
  const issues = [];
  if (!actual) issues.push({ kind: 'article', source: '缺少整章' });
  else {
    for (const source of expected.fragments) if (!actual.normalized.includes(normalize(source))) issues.push({ kind: 'text', source });
    for (const kind of ['code', 'figures', 'figureDrawings', 'tables']) {
      const remaining = [...actual[kind]];
      for (const source of expected[kind]) {
        const i = remaining.indexOf(source);
        if (i < 0) issues.push({ kind, source }); else remaining.splice(i, 1);
      }
    }
  }
  return { textChecks: expected.fragments.length, codeBlocks: expected.code.length,
    figures: expected.figures.length, tables: expected.tables.length, issues };
}

const bundles = new Map();
for (const file of await fs.readdir('content/examples/textbooks')) {
  if (!file.endsWith('.zip')) continue;
  const data = unzipSync(await fs.readFile(`content/examples/textbooks/${file}`));
  bundles.set(file, data);
}
const allBundleHashes = new Map();
for (const [bundle, files] of bundles) for (const [file, data] of Object.entries(files)) {
  const digest = hash(data); if (!allBundleHashes.has(digest)) allBundleHashes.set(digest, []);
  allBundleHashes.get(digest).push(`${bundle}/${file}`);
}
const attachmentHashes = new Map(seed.attachments.map(a => [a.sha256, a.name]));
const books = [];
for (const entry of manifest.books) {
  const relative = `books/${entry.id}.html`, file = path.join(mobileRoot, relative), bytes = await fs.readFile(file);
  const book = catalog.books.find(b => b.id === entry.id);
  const regions = mobileRegions(bytes.toString('utf8'));
  const chapters = regions.map(region => {
    const targetChapter = book?.chapters.find(c => c.anchor === region.anchor);
    const target = region.anchor === 'book-mastery' ? book?.overviewId : targetChapter?.id;
    const result = compare(region.nodes, articles.get(target));
    const navigationIssues = region.navigation.filter(section =>
      !targetChapter?.sections?.some(s => s.anchor === section.anchor && normalize(s.title) === normalize(section.title)));
    return { anchor: region.anchor, title: region.title, target, ...result, sections: region.navigation, navigationIssues };
  });
  const localLinks = new Set();
  for (const region of regions) for (const node of region.nodes) walk(node, n => {
    if (n.tagName !== 'a') return;
    const href = attr(n, 'href');
    if (!href || /^(?:[a-z]+:|\/\/|#)/i.test(href)) return;
    const target = path.resolve(path.dirname(file), decodeURIComponent(href.split(/[?#]/)[0]));
    if (target.startsWith(path.resolve(mobileRoot, 'resources') + path.sep) ||
      (target.startsWith(path.resolve(mobileRoot, 'projects') + path.sep) && !target.endsWith('.html'))) localLinks.add(target);
  });
  const referencedResources = [];
  for (const target of localLinks) {
    const data = await fs.readFile(target), sha256 = hash(data);
    referencedResources.push({ file: path.relative(mobileRoot, target).replaceAll('\\', '/'), sha256,
      present: attachmentHashes.has(sha256) || allBundleHashes.has(sha256),
      matches: [...(attachmentHashes.has(sha256) ? [attachmentHashes.get(sha256)] : []), ...(allBundleHashes.get(sha256) || [])] });
  }
  const zip = path.join(mobileRoot, 'resources', `${entry.id}-labs.zip`);
  const expectedFiles = unzipSync(await fs.readFile(zip)), actualFiles = bundles.get(book?.experimentFile) || {};
  const resources = Object.entries(expectedFiles).filter(([file]) => !file.endsWith('/')).map(([file, bytes]) => {
    const local = file.replace(new RegExp(`^${entry.id}/`), ''), sha256 = hash(bytes);
    const same = actualFiles[local] && hash(actualFiles[local]) === sha256;
    return { file, bytes: bytes.length, sha256, status: same ? 'same-book' : allBundleHashes.has(sha256) ? 'other-bundle' : 'missing',
      ...(same ? {} : { matches: allBundleHashes.get(sha256) || [] }) };
  });
  books.push({ id: entry.id, name: entry.name, mobileFile: file, sha256: hash(bytes), manifestHashMatches: hash(bytes) === manifest.public_hashes[relative],
    modules: entry.modules, mobileChapters: chapters.length - 1, appChapters: book?.chapters.length || 0,
    textChecks: chapters.reduce((s,c) => s + c.textChecks, 0), codeBlocks: chapters.reduce((s,c) => s+c.codeBlocks, 0),
    figures: chapters.reduce((s,c) => s+c.figures, 0), tables: chapters.reduce((s,c) => s+c.tables, 0),
    contentIssues: chapters.reduce((s,c) => s + c.issues.length, 0),
    sectionLinks: chapters.reduce((s,c) => s + c.sections.length, 0),
    navigationIssues: chapters.reduce((s,c) => s + c.navigationIssues.length, 0), chapters, resources, referencedResources });
}
const report = { checkedAt: new Date().toISOString(), mobileRoot, mobileVersion: manifest.content_version, appContentVersion: seed.contentVersion,
  adaptations, books, totals: Object.fromEntries(['mobileChapters', 'appChapters', 'textChecks', 'codeBlocks', 'figures', 'tables', 'contentIssues', 'sectionLinks', 'navigationIssues'].map(key => [key, books.reduce((sum,b) => sum+b[key], 0)])),
  resourceIssues: books.flatMap(b => b.resources.filter(r => r.status !== 'same-book').map(r => ({ book: b.id, ...r }))) };
await fs.writeFile(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ output, totals: report.totals, books: books.map(b => ({ id:b.id, chapters:b.mobileChapters, issues:b.contentIssues,
  examples:b.chapters.flatMap(c => c.issues.map(i => ({ chapter:c.anchor, ...i, source:i.source.slice(0,180) }))).slice(0,4) })), resources: report.resourceIssues }));
if (report.totals.contentIssues || report.resourceIssues.length || report.totals.navigationIssues ||
  books.some(b => !b.manifestHashMatches || b.referencedResources.some(r => !r.present))) process.exitCode = 1;
