import { parse } from 'parse5';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfm } from 'micromark-extension-gfm';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { attr, children, walk, plain, normalize, normalizeCode, isSiteChrome } from './course-fidelity.mjs';

export const hasClass = (n, c) => attr(n, 'class').split(/\s+/).includes(c);
export function mobileDocument(html) {
  const document = parse(html), ids = new Map();
  walk(document, n => { if (attr(n, 'id')) ids.set(attr(n, 'id'), n); });
  const main = ids.get('mMain');
  if (!main || !ids.has('mChapters')) throw Error('Original mobile main/chapter manifest missing');
  const chapterList = JSON.parse(plain(ids.get('mChapters')));
  const chapterNodes = new Set(chapterList.filter(c => c.id !== 'book-mastery').map(c => ids.get(c.id)));
  function clean(n, overview = false) {
    if (!n) throw Error('Original mobile chapter node missing');
    if (overview && chapterNodes.has(n)) return null;
    if (attr(n, 'id') === 'mResume' || hasClass(n, 'm-resource-panel') || hasClass(n, 'm-theend') ||
        (hasClass(n, 'code-bar') && hasClass(n.parentNode || {}, 'm-code'))) return null;
    if (n.tagName === 'pre') {
      const lines = [];
      walk(n, c => { if (hasClass(c, 'ln')) lines.push(plain(c)); });
      if (lines.length) return { ...n, childNodes: [{ nodeName: '#text', value: lines.join('\n') }] };
    }
    return { ...n, childNodes: children(n).map(c => clean(c, overview)).filter(Boolean) };
  }
  const regions = chapterList.filter(c => c.id !== 'book-mastery').map(c => ({
    anchor: c.id, title: c.title, node: clean(ids.get(c.id)),
  }));
  regions.push({ anchor: 'book-mastery', title: '导读、学习路径与参考', node: clean(main, true) });
  return { document, main, ids, regions };
}

export function mobileAuxiliary(html) {
  const document = parse(html); let main;
  walk(document, n => { if (n.tagName === 'main') main = n; });
  if (!main) throw Error('Original auxiliary main missing');
  function clean(n) {
    if (hasClass(n, 'project-download') || (n.tagName === 'a' && /^\.\.\/index\.html(?:#.*)?$/.test(attr(n, 'href'))) ||
        (hasClass(n, 'code-bar') && hasClass(n.parentNode || {}, 'm-code'))) return null;
    return { ...n, childNodes: children(n).map(clean).filter(Boolean) };
  }
  return clean(main);
}

// Consume text in source order. Repeated text must be found again, after the
// previous occurrence: a single matching paragraph cannot hide a lost duplicate.
export function orderedMatch(atoms, text) {
  const target = normalize(text), issues = [];
  let offset = 0, matched = 0;
  for (let i = 0; i < atoms.length; i++) {
    const value = normalize(atoms[i].text);
    if (!value) continue;
    const position = target.indexOf(value, offset);
    if (position >= 0) { offset = position + value.length; matched++; }
    else issues.push({ index: i, kind: target.includes(value) ? 'order-or-repetition' : 'missing-text', ...atoms[i] });
  }
  return { checked: atoms.length, matched, issues };
}

export function originalAtoms(node) {
  const atoms = [], details = [], headings = [], assessments = [], links = [], images = [], pathReferences = [], interactive = [];
  const readable = n => isSiteChrome(n) ? '' : n.nodeName === '#text' ? n.value : children(n).map(readable).join('');
  function visit(n) {
    if (isSiteChrome(n)) return;
    if (attr(n, 'id') === 'thermalSimulator') {
      interactive.push({ id: 'thermalSimulator', adaptation: '知栈原生温控交互；另列功能核验，不用静态文字匹配冒充交互等价。' });
      return;
    }
    if (n.tagName === 'a') links.push({ href: attr(n, 'href'), text: plain(n).trim() });
    if (n.tagName === 'img') images.push({ src: attr(n, 'src'), alt: attr(n, 'alt') });
    if (attr(n, 'data-assess')) {
      const value = { criterion: '', items: [] };
      walk(n, c => {
        if (c.tagName === 'p' && plain(c).startsWith('本章判据')) value.criterion = plain(c).replace(/^本章判据[：:]\s*/, '').trim();
        if (c.tagName === 'label') value.items.push(plain(c).trim());
      });
      assessments.push(value);
      atoms.push(...[value.criterion, ...value.items].filter(Boolean).map(text => ({ type: 'assessment', text })));
      return;
    }
    if (/^h[1-6]$/.test(n.tagName || '')) headings.push({ level: Number(n.tagName[1]), anchor: attr(n, 'id'), text: readable(n).trim() });
    // B23's outer details are individual articles in the destination. Inner
    // exercises stay collapsible. The original's summary-less answers acquire
    // the explicit reader label “展开答案”; their full bodies are still audited.
    if (n.tagName === 'details' && n !== node) details.push(plain(children(n).find(c => c.tagName === 'summary') || {}).trim() || '展开答案');
    if (['code', 'pre'].includes(n.tagName)) {
      const value = plain(n);
      for (const match of value.matchAll(/(?:\.\.\/)?(?:tools|labs|projects)\/[A-Za-z0-9_./-]+/g))
        pathReferences.push({ path: match[0].replace(/[.,;]+$/, ''), context: value.slice(Math.max(0, match.index - 90), match.index + match[0].length + 180) });
    }
    if (n.tagName === 'pre' || n.tagName === 'svg') {
      atoms.push({ type: n.tagName, text: n.tagName === 'pre' ? normalizeCode(plain(n)) : plain(n) });
      return;
    }
    if (n.nodeName === '#text' && normalize(n.value)) atoms.push({ type: 'text', text: n.value });
    children(n).forEach(visit);
  }
  visit(node);
  return { atoms, details, headings, assessments, links, images, pathReferences, interactive };
}

export function markdownStructure(body) {
  const details = [], headings = [], assessments = [], links = [], images = [], anchors = [];
  const parseBody = s => fromMarkdown(s, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });
  const text = n => n.value ?? (n.children || []).map(text).join('');
  function visit(n) {
    if (n.type === 'link') links.push({ href: n.url, text: text(n) });
    if (n.type === 'image') images.push({ src: n.url, alt: n.alt });
    if (n.type === 'heading') headings.push({ level: n.depth, text: text(n) });
    if (n.type === 'code' && n.lang === 'zhizhan-anchor') anchors.push(n.value.trim());
    if (n.type === 'code' && ['zhizhan-details', 'zhizhan-table', 'zhizhan-assessment'].includes(n.lang)) {
      const value = JSON.parse(n.value);
      if (n.lang === 'zhizhan-details') { details.push(value.title); visit(parseBody(value.body)); }
      if (n.lang === 'zhizhan-table') for (const row of value.rows) for (const cell of row) visit(parseBody(cell.body));
      if (n.lang === 'zhizhan-assessment') assessments.push({ criterion: value.criterion, items: value.items.map(i => i.label) });
    }
    (n.children || []).forEach(visit);
  }
  visit(parseBody(body));
  return { details, headings, assessments, links, images, anchors };
}

export function matchMultiset(expected, actual, key = v => normalize(typeof v === 'string' ? v : JSON.stringify(v))) {
  const remaining = actual.map(key), issues = [];
  for (const item of expected) {
    const index = remaining.indexOf(key(item));
    if (index < 0) issues.push(item); else remaining.splice(index, 1);
  }
  return { checked: expected.length, issues };
}
