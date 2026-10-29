import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'parse5';
import { walk, attr, plain, children } from './lib/course-fidelity.mjs';
const root = 'C:/Users/Administrator/Documents/work/手机端书库';
const manifest = JSON.parse(await fs.readFile(path.join(root, 'content-version.json'), 'utf8'));
const known = new Set('a abbr address area article aside audio b base bdi bdo blockquote body br button canvas caption cite code col colgroup data datalist dd del details dfn dialog div dl dt em embed fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 head header hgroup hr html i iframe img input ins kbd label legend li link main map mark menu meta meter nav noscript object ol optgroup option output p picture pre progress q rp rt ruby s samp script search section select slot small source span strong style sub summary sup table tbody td template textarea tfoot th thead time title tr track u ul var video wbr'.split(' '));
const svgElements = new Set(['rect','text','path','line','g','tspan','polyline','polygon','circle','ellipse']);
const textDefects = [], figures = new Map(), rawSvgHtml = [];
const nearest = (n, predicate) => { while (n && !predicate(n)) n = n.parentNode; return n; };
for (const book of manifest.books) {
  const file = path.join(root, 'books', book.id + '.html'), html = await fs.readFile(file, 'utf8');
  // A forbidden HTML tag at the *end* of an SVG can move its label outside the
  // graphic without leaving any unknown elements in the parsed HTML tree.
  for (const match of html.matchAll(/<svg\b[\s\S]*?<\/svg>/g)) {
    const tags = [...match[0].matchAll(/<(?:b|big|blockquote|body|br|center|code|div|em|embed|h[1-6]|head|hr|i|img|li|listing|menu|meta|nobr|ol|p|pre|ruby|s|small|span|strong|strike|sub|sup|table|tt|u|ul|var)\b[^>]*>/g)];
    if (tags.length) rawSvgHtml.push({ book: book.id, file, line: html.slice(0, match.index).split('\n').length,
      svg: match[0].slice(0, match[0].indexOf('>')+1), tags: tags.map(t=>t[0]) });
  }
  const doc = parse(html, { sourceCodeLocationInfo: true }); let main;
  walk(doc, n => { if (attr(n, 'id') === 'mMain') main = n; });
  walk(main, n => {
    if (n.namespaceURI !== 'http://www.w3.org/1999/xhtml' || !n.tagName || known.has(n.tagName)) return;
    const loc = n.sourceCodeLocation, ancestor = nearest(n, a => !!attr(a, 'id'));
    const entry = { book: book.id, file, tag: n.tagName, anchor: attr(ancestor || {}, 'id'), line: loc?.startLine,
      rawTag: loc ? html.slice(loc.startOffset, loc.startTag?.endOffset || loc.endOffset).slice(0, 250) : '',
      context: loc ? html.slice(Math.max(0, loc.startOffset - 100), loc.startOffset + 180) : '' };
    if (svgElements.has(n.tagName)) {
      const figure = nearest(n, a => /(^|\s)fig(\s|$)/.test(attr(a, 'class')) || a.tagName === 'figure');
      const heading = figure && children(figure).find(c => /(^|\s)fig-hd(\s|$)/.test(attr(c, 'class')) || c.tagName === 'figcaption');
      const title = plain(heading || {}).trim(), key = book.id + '/' + title;
      if (!figures.has(key)) figures.set(key, { book: book.id, title, file, anchor: entry.anchor, line: entry.line,
        issue: '图形元素被 HTML 解析器放入 HTML 命名空间，不能按 SVG 绘制。原图的 text 中混入 strong/code 等 HTML 标签，使后续图形脱离 SVG。', elements: [] });
      figures.get(key).elements.push(entry);
    } else textDefects.push({ ...entry, issue: '正文中的尖括号未转义，被解析成 HTML 元素；括号内的类型、头文件或比较条件在阅读时丢失。' });
  });
}
const report = { checkedAt: new Date().toISOString(), root, textDefects, figures: [...figures.values()], rawSvgHtml,
  scope: '检查原版 HTML 的解析损坏；这些问题在原版就已存在。不是用 DOM 一致性测试证明原始标记正确。未知元素候选已按源码上下文人工复核。' };
await fs.writeFile('docs/original-library-markup-findings.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ textDefects: textDefects.length, figures: figures.size, rawSvgHtml: rawSvgHtml.length, books: [...new Set([...textDefects, ...figures.values()].map(f => f.book))],
  details: textDefects.map(d => ({ book: d.book, anchor: d.anchor, rawTag: d.rawTag })) }));
if (textDefects.length || figures.size || rawSvgHtml.length) process.exitCode = 1;
