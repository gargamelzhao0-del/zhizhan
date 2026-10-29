import { parse } from 'parse5';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfm } from 'micromark-extension-gfm';
import { gfmFromMarkdown } from 'mdast-util-gfm';

export const attr = (node, key) => node.attrs?.find(a => a.name === key)?.value || '';
export const children = node => node.childNodes || [];
export const plain = node => node.nodeName === '#text' ? node.value : children(node).map(plain).join('');
export const walk = (node, fn) => { fn(node); children(node).forEach(c => walk(c, fn)); };
export const normalize = text => text.normalize('NFKC').replace(/\s/g, '');
export const normalizeCode = text => text.replace(/\r\n/g, '\n').replace(/^\n/, '').trimEnd();
// Preserve geometry as well as labels. Shared marker definitions may be copied
// into standalone figures by the importer, so compare the actual drawing tree.
export function figureDrawing(node) {
  function drawing(n) {
    if (['defs', 'style'].includes(n.tagName)) return null;
    if (n.nodeName === '#text') return normalize(n.value) || null;
    return { tag: n.tagName, attrs: (n.attrs || []).filter(a => a.name !== 'id')
      .map(a => [a.name, a.value]).sort(([a], [b]) => a.localeCompare(b)), children: children(n).map(drawing).filter(Boolean) };
  }
  return JSON.stringify(drawing(node));
}

// Read the Markdown independently of the HTML importer. Include nested answers,
// tables and SVG labels; comparing code separately keeps operators significant.
export function markdownInventory(body) {
  const code = [], figures = [], figureDrawings = [], fragments = [], tables = [];
  function readBody(markdown) {
    return read(fromMarkdown(markdown, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] }));
  }
  function read(node) {
    if (node.type === 'code') {
      if (node.lang === 'zhizhan-anchor') return '';
      if (node.lang === 'zhizhan-thermal') return '';
      if (node.lang === 'zhizhan-figure') {
        const doc = parse(node.value), text = plain(doc); figures.push(normalize(text));
        walk(doc, n => { if (n.tagName === 'svg') figureDrawings.push(figureDrawing(n)); });
        return text;
      }
      if (node.lang?.startsWith('zhizhan-')) {
        const block = JSON.parse(node.value);
        if (node.lang === 'zhizhan-details') { fragments.push(block.title); return block.title + readBody(block.body); }
        if (node.lang === 'zhizhan-table') {
          const cells = block.rows.map(row => row.map(c => ({ text: readBody(c.body), rowSpan: c.rowSpan, colSpan: c.colSpan })));
          tables.push(JSON.stringify(cells.map(row => row.map(c => ({ ...c, text: normalize(c.text) })))));
          return cells.flat().map(c => c.text).join('');
        }
        if (node.lang === 'zhizhan-assessment') {
          const parts = [block.criterion, ...block.items.map(i => i.label)]; fragments.push(...parts); return parts.join('');
        }
        throw Error(`Unknown course block: ${node.lang}`);
      }
      code.push(normalizeCode(node.value));
    }
    if (node.type === 'html') return '';
    if (node.type === 'text' || node.type === 'inlineCode') fragments.push(node.value);
    if (node.type === 'table') {
      const rows = node.children.map(row => row.children.map(c => ({ text: read(c), rowSpan: 1, colSpan: 1 })));
      tables.push(JSON.stringify(rows.map(row => row.map(c => ({ ...c, text: normalize(c.text) })))));
      return rows.flat().map(c => c.text).join('');
    }
    return node.value ?? (node.children || []).map(read).join('');
  }
  const text = readBody(body);
  return { text, normalized: normalize(text), code, figures, figureDrawings, fragments, tables };
}

// These are the original site's controls/decoration, not lesson prose. Keep this
// list explicit so a new kind of content cannot silently disappear from checks.
export function isSiteChrome(node) {
  return ['script', 'style', 'nav', 'footer', 'button', 'input', 'select', 'textarea', 'canvas'].includes(node.tagName) ||
    (node.tagName === 'a' && /(?:^|\/)volumes\.html(?:[#?]|$)/.test(attr(node, 'href'))) ||
    (node.tagName === 'span' && attr(node, 'class') === 'acc' && plain(node).trim() === '.' && attr(node.parentNode || {}, 'class') === 'ch-title') ||
    /(^|\s)(ch-badge|module-number|module-status|code-dots|lesson-section)(\s|$)/.test(attr(node, 'class'));
}
export function sourceInventory(nodes) {
  const fragments = [], code = [], figures = [], figureDrawings = [], tables = [];
  const inlineText = node => isSiteChrome(node) ? '' : node.nodeName === '#text' ? node.value : children(node).map(inlineText).join('');
  function visit(node) {
    if (isSiteChrome(node) || attr(node, 'id') === 'thermalSimulator') return;
    if (attr(node, 'data-assess')) {
      walk(node, n => {
        if (n.tagName === 'p' && plain(n).startsWith('本章判据')) fragments.push(plain(n).replace(/^本章判据[：:]\s*/, ''));
        if (n.tagName === 'label') fragments.push(plain(n));
      });
      return;
    }
    if (node.tagName === 'pre') { code.push(normalizeCode(plain(node))); return; }
    if (node.tagName === 'svg') { figures.push(normalize(plain(node))); figureDrawings.push(figureDrawing(node)); return; }
    // Whole inline paragraphs/headings also cover short operands and numbers
    // split across emphasis/link nodes, which a fragment-only check can miss.
    if (/^(p|h[1-6]|figcaption|summary|dt|dd)$/.test(node.tagName || '')) {
      const value = inlineText(node).trim();
      if (normalize(value)) fragments.push(value);
    }
    if (node.tagName === 'table') {
      const rows = []; walk(node, n => { if (n.tagName === 'tr') rows.push(children(n).filter(c => ['td', 'th'].includes(c.tagName)).map(c => ({
        text: normalize(plain(c)), rowSpan: Number(attr(c, 'rowspan') || 1), colSpan: Number(attr(c, 'colspan') || 1)
      }))); });
      tables.push(JSON.stringify(rows));
    }
    if (node.nodeName === '#text' && normalize(node.value).length >= 4) fragments.push(node.value.trim());
    children(node).forEach(visit);
  }
  nodes.forEach(visit);
  return { fragments, code, figures, figureDrawings, tables };
}

// Derive the expected reading content from the entire source main, including
// siblings outside .chapter. A lesson-ref following a chapter belongs to it.
export function sourceRegions(html, book) {
  const document = parse(html), ids = new Map(); let main;
  walk(document, node => { if (attr(node, 'id')) ids.set(attr(node, 'id'), node); if (node.tagName === 'main') main = node; });
  if (!main) throw Error(`Source main missing: ${book.id}`);
  const regions = new Map(book.chapters.map(c => [c.id, [ids.get(c.anchor)]]));
  const byNode = new Map(book.chapters.map(c => [ids.get(c.anchor), c.id]));
  const overview = [];
  function split(node) {
    let previous;
    for (const child of children(node)) {
      if (byNode.has(child)) { previous = byNode.get(child); continue; }
      if (isSiteChrome(child)) continue;
      if (/(^|\s)lesson-ref(\s|$)/.test(attr(child, 'class')) && previous) {
        regions.get(previous).push(child); continue;
      }
      let containsChapter = false;
      walk(child, descendant => { if (byNode.has(descendant)) containsChapter = true; });
      if (containsChapter) split(child);
      else overview.push(child);
    }
  }
  split(main);
  regions.set(book.overviewId, overview);
  return regions;
}
