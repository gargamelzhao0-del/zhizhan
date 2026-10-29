// Read-only audit of the exact mobile library named by the user. Never rebuild
// that directory before comparing: generated output is the audit baseline.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';
import { markdownInventory, sourceInventory, normalize } from './lib/course-fidelity.mjs';
import { mobileDocument, mobileAuxiliary, originalAtoms, markdownStructure, orderedMatch, matchMultiset } from './lib/original-library-audit.mjs';

const root = path.resolve(process.argv[2] || 'C:/Users/Administrator/Documents/work/手机端书库');
const out = process.argv[3] || 'docs/original-library-audit.json';
const sourceRoot = 'C:/Users/Administrator/Documents/嵌入式书库原本';
const hash = data => createHash('sha256').update(data).digest('hex');
const json = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const manifest = await json(path.join(root, 'content-version.json'));
const baseline = await json('docs/original-library-audit-baseline.json');
const catalog = await json('content/textbooks/catalog.json');
const seedBytes = await fs.readFile('public/seed/catalog.json');
const seed = JSON.parse(seedBytes);
const articles = new Map(seed.articles.map(a => [a.id, a]));
const appVersion = (await json('package.json')).version;
const attachments = new Map(seed.attachments.map(a => [a.id, a]));
const filesByHash = new Map(), bundles = new Map(), packageProblems = [];
const indexFile = (digest, location) => { if (!filesByHash.has(digest)) filesByHash.set(digest, []); filesByHash.get(digest).push(location); };
for (const a of seed.attachments.filter(a => a.id.startsWith('lesson-'))) {
  const bytes = await fs.readFile(path.join('public/seed', a.path));
  if (hash(bytes) !== a.sha256) packageProblems.push({ kind: 'attachment-hash', name: a.name });
  indexFile(hash(bytes), `附件:${a.name}`);
  if (a.name.endsWith('.zip')) {
    const files = unzipSync(bytes); bundles.set(a.name, files);
    for (const [name, data] of Object.entries(files)) if (!name.endsWith('/')) indexFile(hash(data), `${a.name}/${name}`);
  }
}

// Inspect live desktop and already-built installers, not just the working seed.
const delivery = [], apkPath = `release/zhizhan-${appVersion}-android.apk`;
const apk = unzipSync(await fs.readFile(apkPath));
const liveResponse = await fetch('http://127.0.0.1:8462/seed/catalog.json', { signal: AbortSignal.timeout(15000) });
if (!liveResponse.ok) throw Error(`Live catalog HTTP ${liveResponse.status}`);
const catalogs = [
  ['工作目录', seedBytes],
  ['当前 8462 网页', Buffer.from(await liveResponse.arrayBuffer())],
  ['桌面发布目录', await fs.readFile('release/zhizhan-windows/dist/seed/catalog.json')],
  ['Android 安装包', Buffer.from(apk['assets/public/seed/catalog.json'] || [])],
];
for (const [layer, bytes] of catalogs) {
  let value; try { value = JSON.parse(bytes); } catch { /* Report missing or malformed catalog below. */ }
  delivery.push({ layer, sha256: hash(bytes), matchesWorkingSeed: bytes.equals(seedBytes), contentVersion: value?.contentVersion,
    courseArticles: value?.articles?.filter(a => a.id.startsWith('course-')).length || 0 });
}
for (const a of seed.attachments.filter(a => a.id.startsWith('lesson-'))) {
  const apkBytes = apk[`assets/public/seed/${a.path}`];
  const desktop = await fs.readFile(path.join('release/zhizhan-windows/dist/seed', a.path)).catch(() => null);
  if (!apkBytes || hash(apkBytes) !== a.sha256) packageProblems.push({ kind: 'apk-attachment', name: a.name });
  if (!desktop || hash(desktop) !== a.sha256) packageProblems.push({ kind: 'desktop-attachment', name: a.name });
}

// Inventory every manifested public file without executing any original code.
const baselineFiles = [];
for (const [relative, expectedHash] of Object.entries(manifest.public_hashes)) {
  const bytes = await fs.readFile(path.join(root, relative)).catch(() => null);
  baselineFiles.push({ file: relative, bytes: bytes?.length, sha256: bytes ? hash(bytes) : null, manifestMatches: !!bytes && hash(bytes) === expectedHash });
}
const resourceFiles = [];
for (const [relative, origin] of Object.entries(manifest.resources)) {
  const bytes = await fs.readFile(path.join(root, relative)), digest = hash(bytes);
  resourceFiles.push({ file: relative, source: origin.source, sha256: digest, bytes: bytes.length,
    manifestMatches: digest === origin.sha256, matches: filesByHash.get(digest) || [],
    ...(relative === 'projects/index.html' ? { convertedArticle: 'course-projects', note: 'HTML 转为课程文章，正文、图和链接另逐项核对，不按网页文件字节判缺失。' } : {}) });
}
// Check all project archive members separately; book archives were checked by
// audit-mobile-library.mjs, including exact same-book placement.
const projectResources = [];
for (const [name, bytes] of Object.entries(unzipSync(await fs.readFile(path.join(root, 'resources/projects.zip'))))) {
  if (name.endsWith('/')) continue;
  projectResources.push({ file: name, bytes: bytes.length, sha256: hash(bytes), matches: filesByHash.get(hash(bytes)) || [] });
}

async function stat(file) { try { return await fs.stat(file); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } }
const excludedDirs = new Set(['target', 'build', 'dist', 'out', '__pycache__', 'node_modules', '.git', '.venv']);
async function sourceFiles(directory, prefix) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (excludedDirs.has(entry.name) || entry.name.endsWith('.egg-info')) continue;
    const local = `${prefix}${entry.name}`, file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(file, `${local}/`));
    else if (entry.isFile() && !/\.(o|obj|exe|dll|pdb|pyc|rlib|rmeta)$/i.test(entry.name)) {
      const bytes = await fs.readFile(file); files.push({ path: local, sha256: hash(bytes), bytes: bytes.length });
    }
  }
  return files;
}
async function inspectReference(book, ref) {
  const local = ref.path.replace(/^(?:\.\.\/)+/, '').replace(/\/$/, '');
  const projects = local.startsWith('projects/');
  const sourceBase = projects ? sourceRoot : path.dirname(path.join(sourceRoot, book.href));
  const sourceFile = path.resolve(sourceBase, local);
  if (!sourceFile.startsWith(path.resolve(sourceBase) + path.sep)) throw Error(`Reference outside course: ${local}`);
  const sourceStat = await stat(sourceFile);
  const mobilePath = projects ? path.join(root, local) : path.join(root, 'resources', book.id, local);
  const mobileStat = await stat(mobilePath);
  const bundle = bundles.get(projects ? 'projects.zip' : book.experimentFile) || {};
  const presentInBundle = bundle[local] || Object.keys(bundle).some(name => name.startsWith(local + '/'));
  const result = { ...ref, path: local, mobilePresent: !!mobileStat, appPresent: !!presentInBundle };
  if (/\.(o|obj|elf|exe)$/i.test(local) || (!path.extname(local) && !!(await stat(sourceFile + '.c')))) {
    result.status = 'build-output';
  } else if (ref.context.includes('$IDF_PATH/' + local)) {
    result.status = 'external-sdk-file'; result.note = 'ESP-IDF 安装目录中的构建文件，不属于本书应随包提供的源码。';
  } else if (sourceStat) {
    const expected = sourceStat.isDirectory() ? await sourceFiles(sourceFile, local + '/') :
      [{ path: local, sha256: hash(await fs.readFile(sourceFile)), bytes: sourceStat.size }];
    result.files = [];
    for (const file of expected) {
      const mobile = await fs.readFile(projects ? path.join(root, file.path) : path.join(root, 'resources', book.id, file.path)).catch(() => null);
      const app = bundle[file.path];
      result.files.push({ ...file, mobileMatches: !!mobile && hash(mobile) === file.sha256, appMatches: !!app && hash(app) === file.sha256,
        appOtherLocations: filesByHash.get(file.sha256) || [] });
    }
    result.status = result.files.every(f => f.appMatches) ? (result.files.every(f => f.mobileMatches) ? 'both-present' : 'app-supplement') :
      result.files.some(f => f.mobileMatches && !f.appMatches) ? 'migration-gap' : 'missing-in-both';
  } else if (/\/$/.test(ref.path) || /_$/.test(local)) {
    result.status = 'path-pattern';
  } else {
    result.status = 'unresolved-example-path';
  }
  return result;
}

const books = [], renderingInput = [], auxiliary = [];
for (const b of [...manifest.books].sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }))) {
  const book = catalog.books.find(c => c.id === b.id);
  const prior = baseline.books.find(c => c.id === b.id);
  const file = path.join(root, 'books', `${b.id}.html`);
  const mobile = mobileDocument(await fs.readFile(file, 'utf8'));
  const chapters = [], refs = new Map();
  for (const region of mobile.regions) {
    const id = region.anchor === 'book-mastery' ? book.overviewId : book.chapters.find(c => c.anchor === region.anchor)?.id;
    const article = articles.get(id);
    if (!article) throw Error(`Destination article missing: ${b.id}/${region.anchor}`);
    const original = originalAtoms(region.node), actual = markdownStructure('# ' + article.title + '\n\n' + article.body);
    const inventory = markdownInventory(article.title + '\n\n' + article.body);
    const ordered = orderedMatch(original.atoms, inventory.text);
    const details = matchMultiset(original.details, actual.details);
    const headings = matchMultiset(original.headings, actual.headings, h => normalize(h.text));
    const headingPresentationDifferences = headings.issues.filter(h => inventory.normalized.includes(normalize(h.text)));
    headings.issues = headings.issues.filter(h => !headingPresentationDifferences.includes(h));
    const assessments = matchMultiset(original.assessments, actual.assessments);
    const externalLinks = original.links.filter(l => /^https?:\/\//.test(l.href));
    const linkCheck = matchMultiset(externalLinks, actual.links, l => l.href);
    const brokenAttachments = actual.links.filter(l => /^(asset|attachment):/.test(l.href) && !attachments.has(l.href.replace(/^(asset|attachment):/, '')));
    const missingAnchors = (book.chapters.find(c => c.id === id)?.sections || []).filter(s => !actual.anchors.includes(s.anchor));
    for (const ref of original.pathReferences) {
      if (!refs.has(ref.path)) refs.set(ref.path, { ...ref, chapters: [] });
      if (!refs.get(ref.path).chapters.includes(region.anchor)) refs.get(ref.path).chapters.push(region.anchor);
    }
    const sourceCounts = prior.chapters.find(c => c.anchor === region.anchor);
    chapters.push({ anchor: region.anchor, title: region.title, target: id, ...Object.fromEntries(['textChecks', 'codeBlocks', 'figures', 'tables'].map(k => [k, sourceCounts[k]])),
      ordered, details, headings, headingPresentationDifferences, assessments, externalLinks: linkCheck, brokenAttachments, missingAnchors, interactive: original.interactive,
      appVisibleCharacters: inventory.normalized.length });
    renderingInput.push({ book: b.id, id, source: `${file}#${region.anchor}`, headings: original.headings, details: original.details,
      assessments: original.assessments, fragments: original.atoms.map(a => a.text),
      anchors: (book.chapters.find(c => c.id === id)?.sections || []).map(s => s.anchor) });
  }
  const references = [];
  for (const ref of refs.values()) references.push(await inspectReference(book, ref));
  books.push({ id: b.id, name: b.name, sourceFile: file, modules: b.modules,
    chapters: chapters.length - 1, guides: 1, chapterDetails: chapters, references,
    counts: { code: prior.codeBlocks, figures: prior.figures, tables: prior.tables, sections: prior.sectionLinks,
      details: chapters.reduce((n, c) => n + c.details.checked, 0), assessments: chapters.reduce((n, c) => n + c.assessments.checked, 0),
      externalLinks: chapters.reduce((n, c) => n + c.externalLinks.checked, 0), filesInMobileZip: prior.resources.length },
    textAndBlockIssues: prior.contentIssues, navigationIssues: prior.navigationIssues,
    structuralIssues: chapters.flatMap(c => [
      ...c.ordered.issues.map(i => ({ chapter: c.anchor, category: 'ordered-text', ...i })),
      ...['details','headings','assessments','externalLinks'].flatMap(kind => c[kind].issues.map(value => ({ chapter: c.anchor, category: kind, value }))),
      ...c.brokenAttachments.map(value => ({ chapter: c.anchor, category: 'broken-attachment', value })),
      ...c.missingAnchors.map(value => ({ chapter: c.anchor, category: 'missing-anchor', value })),
    ]) });
  console.log(`${b.id}: ${chapters.length - 1} chapters, ${books.at(-1).structuralIssues.length} structural findings, ${references.filter(r => /gap|missing|unresolved/.test(r.status)).length} reference candidates`);
}

// The original library's three shared reading pages are also imported courses.
for (const spec of [
  { file: 'projects/index.html', id: 'course-projects' },
  { file: 'projects/learning-path.html', id: 'course-learning-path' },
  { file: 'projects/quality-review.html', id: 'course-quality-review' },
]) {
  const node = mobileAuxiliary(await fs.readFile(path.join(root, spec.file), 'utf8'));
  const original = originalAtoms(node), expected = sourceInventory([node]);
  const article = articles.get(spec.id), actual = markdownInventory(article.title + '\n\n' + article.body);
  const structure = markdownStructure('# ' + article.title + '\n\n' + article.body);
  const ordered = orderedMatch(original.atoms, actual.text);
  const blocks = Object.fromEntries(['code','figures','figureDrawings','tables'].map(kind => [kind, matchMultiset(expected[kind], actual[kind], s => s)]));
  auxiliary.push({ ...spec, ordered, blocks, details: matchMultiset(original.details, structure.details),
    assessments: matchMultiset(original.assessments, structure.assessments),
    externalLinks: matchMultiset(original.links.filter(l => /^https?:\/\//.test(l.href)), structure.links, l => l.href),
    images: original.images });
  renderingInput.push({ book: '共享项目与导读', id: spec.id, source: path.join(root, spec.file), fragments: original.atoms.map(a => a.text),
    headings: original.headings, details: original.details, assessments: original.assessments, anchors: [] });
}
const report = { checkedAt: new Date().toISOString(), mobileRoot: root, baselineVersion: manifest.content_version,
  appVersion, appContentVersion: seed.contentVersion, sourceRootUsedOnlyToTraceReferencedFiles: sourceRoot,
  scope: ['只读检查指定目录当前的实际 HTML/资源；修复前原库快照的保全结果另见 integrity-repair-original-preservation.json。', '正文、代码、图形结构、表格、折叠答案、自评、章节入口分别核对；文字额外按原顺序逐次消费，检查重复段落。',
    '路径引用检查区分原库与知栈同时缺失、迁移缺失、知栈补充、示例自建路径和编译产物。编写源目录仅用于追查正文点名的文件，不替代用户指定的基准。',
    '此为迁移与可访问性核对，不授予教材质量合格或实机实验通过结论。'],
  delivery, packageProblems, baselineFiles, resourceFiles, projectResources, books, auxiliary };
await fs.writeFile(out, JSON.stringify(report, null, 2));
await fs.writeFile('docs/original-library-render-input.json', JSON.stringify(renderingInput, null, 2));
console.log(JSON.stringify({ output: out, books: books.length, delivery, packageProblems: packageProblems.length,
  baselineHashIssues: baselineFiles.filter(f => !f.manifestMatches).length,
  resourceFiles: resourceFiles.length, resourceGaps: resourceFiles.filter(f => !f.matches.length && !f.convertedArticle).map(f => f.file),
  projectFiles: projectResources.length, projectGaps: projectResources.filter(f => !f.matches.length).map(f => f.file),
  structuralIssues: books.reduce((n, b) => n + b.structuralIssues.length, 0),
  auxiliary: auxiliary.map(a => ({ id: a.id, textIssues: a.ordered.issues.length, blockIssues: Object.values(a.blocks).reduce((s, b) => s + b.issues.length, 0) })) }));
