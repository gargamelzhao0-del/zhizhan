import fs from 'node:fs/promises';
import path from 'node:path';
import { unzipSync } from 'fflate';
import { parse } from 'parse5';
import { markdownInventory, sourceInventory, sourceRegions, normalize, walk } from './lib/course-fidelity.mjs';

const sourceRoot = process.argv[2] || 'C:/Users/Administrator/Documents/嵌入式书库原本';
const reportPath = process.argv[3] || 'docs/course-completeness-report.json';
const catalog = JSON.parse(await fs.readFile('content/textbooks/catalog.json', 'utf8'));
const seed = JSON.parse(await fs.readFile('public/seed/catalog.json', 'utf8'));
const sourceCatalog = JSON.parse(await fs.readFile(path.join(sourceRoot, 'curriculum.json'), 'utf8'));
const articles = new Map(seed.articles.map(a => [a.id, a]));
const books = [];
for (const book of catalog.books) {
  const sourceBook = sourceCatalog.books.find(b => b.id === book.id);
  const sourceFile = path.join(sourceRoot, sourceBook.href);
  const regions = sourceRegions(await fs.readFile(sourceFile, 'utf8'), book);
  const issues = [], counts = { articles: 0, textFragments: 0, codeBlocks: 0, figures: 0, tables: 0, experimentFiles: 0 };
  for (const [id, nodes] of regions) {
    const article = articles.get(id);
    if (!article) { issues.push({ id, kind: 'missing-article' }); continue; }
    const expected = sourceInventory(nodes);
    const actual = markdownInventory(article.title + '\n\n' + article.body);
    counts.articles++;
    counts.textFragments += expected.fragments.length;
    counts.codeBlocks += expected.code.length;
    counts.figures += expected.figures.length;
    counts.tables += expected.tables.length;
    for (const fragment of expected.fragments) {
      if (!actual.normalized.includes(normalize(fragment))) issues.push({ id, kind: 'text', source: fragment });
    }
    // Remove each match so duplicating one block cannot conceal another loss.
    for (const kind of ['code', 'figures', 'tables']) {
      const remaining = [...actual[kind]];
      for (const value of expected[kind]) {
        const index = remaining.indexOf(value);
        if (index < 0) issues.push({ id, kind, source: value.slice(0, 240) });
        else remaining.splice(index, 1);
      }
    }
  }
  if (book.experimentFile) {
    const archive = unzipSync(await fs.readFile(`content/examples/textbooks/${book.experimentFile}`));
    // Audit all source files independently of the importer's extension allowlist.
    // Only build outputs/cache and packaging metadata are outside the source set.
    async function check(directory, prefix) {
      let entries; try { entries = await fs.readdir(directory, { withFileTypes: true }); } catch (e) { if (e.code === 'ENOENT') return; throw e; }
      for (const entry of entries) {
        if ((entry.name.startsWith('.') && entry.name !== '.cargo') || /^(build|out|target|__pycache__|node_modules)$|\.egg-info$/.test(entry.name)) continue;
        const file = path.join(directory, entry.name), key = prefix + entry.name;
        if (entry.isDirectory()) await check(file, key + '/');
        else if (!/\.(o|obj|exe|dll|pdb|pyc)$/i.test(entry.name)) {
          counts.experimentFiles++;
          const bytes = await fs.readFile(file);
          if (!archive[key] || !bytes.equals(Buffer.from(archive[key]))) issues.push({ id: book.overviewId, kind: 'experiment-file', source: key });
        }
      }
    }
    for (const sub of ['labs', 'tools/probes', 'tools/src']) await check(path.join(path.dirname(sourceFile), sub), sub + '/');
    // Explicit regressions for dependencies referenced in prose, outside labs/.
    if (book.id === 'B03') await check(path.join(path.dirname(sourceFile), 'tools/cargo-demo'), 'tools/cargo-demo/');
    if (book.id === 'B01') {
      for (const key of ['tools/sm_model.js', 'verify/src/177__hsm.c']) {
        counts.experimentFiles++;
        const bytes = await fs.readFile(path.join(sourceRoot, key));
        if (!archive[key] || !bytes.equals(Buffer.from(archive[key]))) issues.push({ id: book.overviewId, kind: 'experiment-file', source: key });
      }
    }
  }
  books.push({ id: book.id, ...counts, issues });
}
const libraryPages = [];
for (const item of catalog.auxiliary) {
  const doc = parse(await fs.readFile(path.join(sourceRoot, item.href), 'utf8'));
  let main, body; walk(doc, n => { if (n.tagName === 'main') main = n; if (n.tagName === 'body') body = n; });
  const expected = sourceInventory([main || body]);
  const article = articles.get(item.id), actual = markdownInventory(article.title + '\n\n' + article.body);
  const issues = expected.fragments.filter(s => !actual.normalized.includes(normalize(s))).map(source => ({ id: item.id, kind: 'text', source }));
  for (const kind of ['code', 'figures', 'tables']) {
    const remaining = [...actual[kind]];
    for (const source of expected[kind]) { const index = remaining.indexOf(source); if (index < 0) issues.push({ id: item.id, kind, source: source.slice(0, 240) }); else remaining.splice(index, 1); }
  }
  libraryPages.push({ id: item.id, articles: 1, textFragments: expected.fragments.length, codeBlocks: expected.code.length, figures: expected.figures.length, tables: expected.tables.length, experimentFiles: 0, issues });
}
const all = [...books, ...libraryPages];
// The six-project archive has its own source root. If B01 has no experiments
// of its own, the importer additionally supplies the starter firmware there.
const supplementalBundles = [];
const bundleSpecs = [{ file: 'projects.zip', directory: 'projects', prefix: 'projects/' }];
bundleSpecs.push({ file: 'b01-experiments.zip', directory: 'projects/p01_stm32f103', prefix: 'labs/', extra: ['projects/p01_acquisition.py', 'labs/p01_acquisition.py'] });
for (const spec of bundleSpecs) {
  const archive = unzipSync(await fs.readFile(`content/examples/textbooks/${spec.file}`));
  const issues = []; let files = 0;
  async function compare(file, key) {
    files++;
    if (!archive[key] || !(await fs.readFile(file)).equals(Buffer.from(archive[key]))) issues.push(key);
  }
  async function scan(directory, prefix) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || /^(build|out|target|__pycache__|node_modules)$|\.egg-info$/.test(entry.name)) continue;
      const file = path.join(directory, entry.name), key = prefix + entry.name;
      if (entry.isDirectory()) await scan(file, key + '/');
      else if (!/\.(o|obj|exe|dll|pdb|pyc)$/i.test(entry.name)) await compare(file, key);
    }
  }
  await scan(path.join(sourceRoot, spec.directory), spec.prefix);
  if (spec.extra) await compare(path.join(sourceRoot, spec.extra[0]), spec.extra[1]);
  supplementalBundles.push({ file: spec.file, files, issues });
}
const report = { checkedAt: new Date().toISOString(), sourceRoot, contentVersion: seed.contentVersion,
  scope: 'All source main content except original-site UI/footer; self-assessment controls and thermal simulator have native equivalents. Code is compared verbatim, experiment files byte for byte. This verifies migration, not technical correctness or target-board execution.',
  totals: Object.fromEntries(['articles', 'textFragments', 'codeBlocks', 'figures', 'tables', 'experimentFiles'].map(k => [k, all.reduce((s,b) => s + b[k], 0)])),
  issues: [...all, ...supplementalBundles].reduce((s,b) => s + b.issues.length, 0), books, libraryPages, supplementalBundles };
await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ reportPath, ...report, books: books.map(b => ({ id: b.id, issues: b.issues.length, examples: b.issues.slice(0, 2) })) }));
if (report.issues) process.exitCode = 1;
