// Capture the user's HTML books as portable, editable chapters. No prototype JS runs in the app.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { parse, serializeOuter } from "parse5";
import { zipSync, strToU8 } from "fflate";
import { annotateTerms } from "./annotate-terms.mjs";
const app = path.resolve(import.meta.dirname, "..");
const root = path.resolve(
  process.argv[2] ||
    "C:/Users/Administrator/Documents/嵌入式书库原本",
);
const output = path.join(app, "content/textbooks");
await fs.mkdir(output, { recursive: true });
const curriculum = JSON.parse(
  await fs.readFile(path.join(root, "curriculum.json"), "utf8"),
);
const resources = JSON.parse(await fs.readFile(path.join(root, 'course-resources.json'), 'utf8'));
// Keep a chapter's identity when the prototype inserts or reorders chapters;
// reading history and notes must not silently move to a different lesson.
let previousBooks = [];
try { previousBooks = JSON.parse(await fs.readFile(path.join(output, 'catalog.json'), 'utf8')).books; }
catch (e) { if (e.code !== 'ENOENT') throw e; }
const stableIds = new Map(previousBooks.flatMap(b => b.chapters.map(c => [`${b.id}/${c.anchor}`, c.id])));
const reservedIds = new Set(stableIds.values());
const attr = (n, key) => n.attrs?.find((a) => a.name === key)?.value || "";
const children = (n) => n.childNodes || [];
const text = (n) =>
  n.nodeName === "#text" ? n.value : children(n).map(text).join("");
function walk(n, fn) {
  fn(n);
  for (const c of children(n)) walk(c, fn);
}
const clean = (s) => s.replace(/\s+/g, " ").trim();
const escape = (s) => s.replace(/([\\`*_[\]<>+])/g, "\\$1");
const digest = (s) => createHash("sha256").update(s).digest("hex");
const files = new Map(),
  targets = new Map(),
  assets = new Map(),
  unresolved = [],
  reports = [];
async function collectExamples(directory, prefix = "") {
  const collected = {};
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return collected;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (
      (entry.name.startsWith(".") && entry.name !== '.cargo') ||
      /^(build|out|__pycache__|node_modules|target)$|\.egg-info$/.test(entry.name)
    )
      continue;
    const file = path.join(directory, entry.name),
      key = `${prefix}${entry.name}`;
    if (entry.isDirectory())
      Object.assign(collected, await collectExamples(file, `${key}/`));
    else if (!/\.(o|obj|exe|dll|pdb|pyc)$/i.test(entry.name)) {
      const bytes = await fs.readFile(file);
      if (bytes.length > 3 * 1024 * 1024) throw Error(`Experiment file exceeds the bundle limit: ${file}`);
      collected[key] = new Uint8Array(bytes);
    }
  }
  return collected;
}
for (const book of curriculum.books) {
  // A new identity must not resurrect or overwrite retired copies and their notes.
  book.shelfId = `course-${book.id.toLowerCase()}`;
  book.overviewId = `${book.shelfId}-guide`;
  book.chapters = [];
  const file = path.resolve(
    root,
    book.href || `${book.id.toLowerCase()}/index.html`,
  );
  targets.set(file, book.overviewId);
  if (!book.href) continue;
  const html = await fs.readFile(file, "utf8"),
    doc = parse(html),
    ids = new Map();
  walk(doc, (n) => {
    if (attr(n, "id")) ids.set(attr(n, "id"), n);
  });
  // The old JS registry omits roadmaps, glossaries and project appendices.
  // Import the same 407 reading sections exposed by the reviewed mobile library.
  const chapterIds = [];
  walk(doc,n=>{
    if(['section','details'].includes(n.tagName) && /(^|\s)(chapter|reader-chapter)(\s|$)/.test(attr(n,'class')))
      chapterIds.push(attr(n,'id'));
  });
  if(!chapterIds.length || new Set(chapterIds).size!==chapterIds.length)throw Error(`Invalid reading sections: ${book.id}`);
  const defs = [];
  walk(doc, (n) => {
    if (n.tagName === "defs") defs.push(serializeOuter(n));
  });
  for (const [i, id] of chapterIds.entries()) {
    const node = ids.get(id);
    if (!node) throw Error(`Missing chapter: ${book.id}/${id}`);
    const sequentialId = `${book.shelfId}-${id.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`;
    const articleId = stableIds.get(`${book.id}/${id}`) || (reservedIds.has(sequentialId) ? `${book.shelfId}-src-${id.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}` : sequentialId);
    if (!stableIds.has(`${book.id}/${id}`) && reservedIds.has(articleId)) throw Error(`Duplicate stable chapter id: ${articleId}`);
    reservedIds.add(articleId);
    let heading;
    walk(node, (n) => {
      if (!heading && /^(h1|h2|summary)$/.test(n.tagName || "")) heading = n;
    });
    const title = clean(text(heading || node))
      .replace(/入门正文$/, "")
      .trim()
      .replace(/\.$/, "");
    const chapter = {
      id: articleId,
      anchor: id,
      title,
      order: i + 1,
      file: `${articleId}.md`,
      kind: "chapter",
    };
    // Match the source mobile book's section directory (h2 with ids, or h3
    // when there are no h2 anchors) so a long chapter is discoverable in full.
    chapter.sections = [];
    for (const tag of ['h2', 'h3']) {
      walk(node, n => {
        if (n.tagName === tag && attr(n, 'id') && clean(text(n)))
          chapter.sections.push({ anchor: attr(n, 'id'), title: clean(text(n)) });
      });
      if (chapter.sections.length) break;
    }
    book.chapters.push(chapter);
    walk(node, (n) => {
      if (attr(n, "id"))
        targets.set(
          `${file}#${attr(n, "id")}`,
          `${articleId}#${attr(n, "id")}`,
        );
    });
  }
  for (const module of book.modules) {
    const local = module.id.split('-').at(-1).toLowerCase();
    const anchor = book.id === 'B01' ? `ch${Number(local.slice(1))}` : local;
    const chapter = book.chapters.find(c => [anchor, module.id.toLowerCase()].includes(c.anchor.toLowerCase()));
    if (!chapter) throw Error(`Module has no readable chapter: ${module.id}`);
    module.articleId = chapter.id;
  }
  // References in early volumes are siblings of .chapter, not descendants.
  // Preserve their association with the preceding chapter, then retain all other
  // reading content (introductions, source lists and diagrams) in the guide.
  const chapterNodes = new Map(book.chapters.map(c => [ids.get(c.anchor), c.anchor]));
  const chapterExtras = new Map(book.chapters.map(c => [c.anchor, []]));
  const assignedReferences = new Set();
  walk(doc, parent => {
    let preceding;
    for (const child of children(parent)) {
      if (chapterNodes.has(child)) preceding = chapterNodes.get(child);
      if (preceding && /(^|\s)lesson-ref(\s|$)/.test(attr(child, 'class'))) {
        chapterExtras.get(preceding).push(child); assignedReferences.add(child);
      }
    }
  });
  let main; walk(doc, n => { if (n.tagName === 'main') main = n; });
  function guideContent(node) {
    if (chapterNodes.has(node) || assignedReferences.has(node) ||
      ['nav', 'footer', 'script', 'style'].includes(node.tagName) ||
      /(^|\s)lesson-section(\s|$)/.test(attr(node, 'class'))) return null;
    return { ...node, childNodes: children(node).map(guideContent).filter(Boolean) };
  }
  const guideRoot = guideContent(main);
  walk(guideRoot, n => {
    if (attr(n, 'id')) targets.set(`${file}#${attr(n, 'id')}`, `${book.overviewId}#${attr(n, 'id')}`);
  });
  files.set(book.id, { file, ids, defs, html, guideRoot, chapterExtras });
  if (!ids.has('book-mastery')) throw Error(`Missing reviewed reading contract: ${book.id}`);
  book.guide = { id: book.overviewId, anchor: 'book-mastery', title: `${book.name} · 学习路线`, file: `${book.overviewId}.md`, kind: 'guide' };
  walk(ids.get('book-mastery'), n => {
    if (attr(n,'id')) targets.set(`${file}#${attr(n,'id')}`, `${book.overviewId}#${attr(n,'id')}`);
  });
  book.sourceSha256 = digest(html);
  const references = new Map();
  walk(doc, (n) => {
    if (n.tagName === "a" && /^https?:/.test(attr(n, "href")))
      references.set(attr(n, "href"), clean(text(n)) || attr(n, "href"));
  });
  book.references = [...references].map(([url, title]) => ({ url, title }));
  const directory = path.dirname(file);
  const experiments = {};
  const extra = resources.books[book.id] || {};
  for (const folder of [...resources.directories, ...(extra.directories || [])])
    Object.assign(experiments, await collectExamples(path.join(directory, folder), `${folder}/`));
  for (const file of extra.files || [])
    experiments[file] = new Uint8Array(await fs.readFile(path.join(directory, file)));
  if (book.id === 'B01') {
    Object.assign(experiments, await collectExamples(path.join(root, 'projects/p01_stm32f103'), 'labs/'));
    experiments['labs/p01_acquisition.py'] = new Uint8Array(await fs.readFile(path.join(root, 'projects/p01_acquisition.py')));
    experiments['README.txt'] = strToU8('B01 逐节片段保留在正文。本包提供配套的完整 STM32F103C8 固件（启动、链接、外设）及 Python 接收/回放参考；具体时钟、电气和上板结果按 P01 验收。\r\n');
  }
  if (Object.keys(experiments).length) {
    book.experimentFile = `${book.id.toLowerCase()}-experiments.zip`;
    book.experimentCount = Object.keys(experiments).length;
    experiments["README.md"] = strToU8(
      `# ${book.name} · 实验源码\n\n从课程原型保留的 ${book.experimentCount} 个文件。按照各章命令与平台条件使用。Shell 脚本需要兼容的 Bash 环境；MCU 寄存器示例需要对应芯片、工具链与板级工程，不能直接当成可烧录的完整固件。\n\n本次资料迁移不代表所有示例均已重新执行。原文测试记录、主机验证和目标板验证应分别对待。\n`,
    );
    const stableEntries = Object.fromEntries(
      Object.entries(experiments).map(([name, data]) => [
        name,
        [data, { mtime: new Date("2026-10-13T00:00:00Z") }],
      ]),
    );
    await fs.mkdir(path.join(app, "content/examples/textbooks"), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(app, "content/examples/textbooks", book.experimentFile),
      zipSync(stableEntries, { level: 6 }),
    );
  }
}
const auxiliary = [
  { id: 'course-learning-path', title: '从零基础到独立嵌入式项目', href: 'learning-path.html' },
  { id: 'course-quality-review', title: '27 册逐册审查与验证边界', href: 'quality-review.html' },
  { id: 'course-projects', title: '六项综合项目与工程资料', href: 'projects/index.html' },
];
for (const item of auxiliary) {
  const file = path.resolve(root,item.href), html = await fs.readFile(file,'utf8');
  const doc = parse(html), ids = new Map(); let body,main;
  walk(doc,n=>{ if(n.tagName==='body')body=n; if(n.tagName==='main')main=n; if(attr(n,'id'))ids.set(attr(n,'id'),n); });
  ids.set('document-root',main||body);
  item.file = `${item.id}.md`; item.anchor = 'document-root'; item.kind = 'resource';
  targets.set(file,item.id);
  for(const id of ids.keys())targets.set(`${file}#${id}`,`${item.id}#${id}`);
  files.set(item.id,{file,html,ids});
}
targets.set(path.resolve(root,'quality-dashboard.html'),'course-quality-review');
targets.set(path.resolve(root,'curriculum.html'),'course-learning-path');
curriculum.installationVersion = '2026.10.13.5';
curriculum.auxiliary = auxiliary;
const projectFiles = await collectExamples(path.join(root,'projects'),'projects/');
await fs.mkdir(path.join(app,'content/examples/textbooks'),{recursive:true});
await fs.writeFile(path.join(app,'content/examples/textbooks/projects.zip'),zipSync(Object.fromEntries(
  Object.entries(projectFiles).map(([name,data])=>[name,[data,{mtime:new Date('2026-10-13T00:00:00Z')}]])),{level:6}));
for(const project of curriculum.projects)project.articleId=`course-projects#${project.id}`;
async function attachment(file) {
  const relative = path.relative(root, file).replaceAll("\\", "/");
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    !(/\.(c|h|cc|cpp|hpp|ino|py|rs|txt|csv|json|png|jpg|jpeg|webp|md|zip|sh|conf|toml|onnx|svg|bin|elf|map|ld|dts|dtsi|bb|bbappend|cmd|bat|ps1|js|mjs|ts|css|yaml|yml|cfg|cmake)$/i.test(file) || ['Makefile','CMakeLists.txt','Kconfig','sdkconfig','sdkconfig.defaults'].includes(path.basename(file)))
  )
    return "";
  if (!assets.has(relative)) {
    const data = await fs.readFile(file);
    if (data.length > 3 * 1024 * 1024)
      throw Error(`Oversized textbook asset: ${relative}`);
    const destination = path.join(app, "content/examples/textbooks", relative);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, data);
    assets.set(relative, { path: relative, sha256: digest(data) });
  }
  return `textbook-file:${relative}`;
}
const structured = (kind, value) => {
  const json=JSON.stringify(value), fence='`'.repeat(Math.max(3,...[...json.matchAll(/`+/g)].map(m=>m[0].length+1)));
  return `\n\n${fence}zhizhan-${kind}\n${json}\n${fence}\n\n`;
};
for (const book of [...curriculum.books, ...auxiliary.map(item=>({id:item.id,chapters:[item]}))]) {
  const source = files.get(book.id);
  if (!source) continue;
  for (const chapter of [...book.chapters,...(book.guide ? [book.guide] : [])]) {
    const stats = {
      id: chapter.id,
      kind: chapter.kind,
      code: 0,
      figures: 0,
      tables: 0,
      anchors: 0,
    };
    let firstHeading;
    const readingRoot = chapter.kind === 'guide' ? source.guideRoot : source.ids.get(chapter.anchor);
    walk(readingRoot, (n) => {
      if (chapter.kind !== 'chapter') return;
      if (!firstHeading && /^(h1|h2|summary)$/.test(n.tagName || ""))
        firstHeading = n;
    });
    const renderChildren = async (n) =>
      (await Promise.all(children(n).map(render))).join("");
    async function render(n) {
      if (n.nodeName === "#text") return escape(n.value.replace(/\s+/g, " "));
      const tag = n.tagName;
      if (
        n === firstHeading ||
        /(^|\s)(ch-badge|module-number|module-status|code-dots)(\s|$)/.test(
          attr(n, "class"),
        )
      )
        return "";
      if (
        [
          "script",
          "style",
          "button",
          "input",
          "select",
          "canvas",
          "nav",
        ].includes(tag)
      )
        return "";
      if (attr(n, "id") === "thermalSimulator")
        return "\n\n```zhizhan-thermal\nthermal-pi\n```\n\n";
      const id = attr(n, "id");
      const anchor = id ? `\n\n\`\`\`zhizhan-anchor\n${id}\n\`\`\`\n\n` : "";
      if (id) stats.anchors++;
      if (attr(n,'class').split(/\s+/).includes('ch-meta')) {
        const items = await Promise.all(children(n).filter(c=>c.tagName==='span').map(async c=>clean(await renderChildren(c))));
        return '\n\n> '+items.join(' · ')+'\n\n';
      }
      if (attr(n,'data-assess')) {
        let criterion=''; const items=[];
        walk(n,c=>{
          if(c.tagName==='p' && /本章判据/.test(text(c)))criterion=clean(text(c)).replace(/^本章判据[：:]\s*/,'');
          if(c.tagName==='label'){
            const input=children(c).find(x=>attr(x,'data-criterion'));
            if(input)items.push({id:attr(input,'data-criterion'),label:clean(text(c))});
          }
        });
        if(!criterion||items.length!==3)throw Error(`Incomplete assessment: ${chapter.id}`);
        return anchor + structured('assessment',{id:chapter.id,criterion,items});
      }
      if(tag==='details') {
        const summary=children(n).find(c=>c.tagName==='summary');
        const body=(await Promise.all(children(n).filter(c=>c!==summary).map(render))).join('').trim();
        if(chapter.kind==='chapter' && n===source.ids.get(chapter.anchor))return anchor+'\n\n'+body+'\n\n';
        return anchor + structured('details',{title:clean(text(summary||{childNodes:[]}))||'展开答案',body});
      }
      if(tag==='textarea')return '\n\n请使用本文的“笔记”记录任务、阅读/实现/排错投入、失败证据和复验结果；记录随完整备份保存。\n\n';
      if (tag === "svg") {
        stats.figures++;
        let svg = serializeOuter(n).replace(
          "auto-start-r###rse",
          "auto-start-reverse",
        );
        // A standalone chapter cannot depend on a marker defined in another chapter.
        const ownIds = new Set([...svg.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
        const references = new Set([...svg.matchAll(/url\(#([\w-]+)\)/g)].map(m => m[1]));
        const definitions = [...references].filter(id => !ownIds.has(id) && source.ids.has(id)).map(id => serializeOuter(source.ids.get(id))).join('');
        if (definitions) svg = svg.replace(/(<svg[^>]*>)/, `$1<defs>${definitions}</defs>`);
        return `\n\n\`\`\`zhizhan-figure\n${svg}\n\`\`\`\n\n`;
      }
      if (tag === "pre") {
        stats.code++;
        const value = text(n).replace(/^\n/, "").trimEnd();
        const fence = "`".repeat(
          Math.max(
            3,
            ...[...value.matchAll(/`+/g)].map((m) => m[0].length + 1),
          ),
        );
        const code = children(n).find((c) => c.tagName === "code");
        const lang =
          attr(code || n, "class").match(/language-([\w+-]+)/)?.[1] || "text";
        return `\n\n${fence}${lang}\n${value}\n${fence}\n\n`;
      }
      if (tag === "code" || tag === "kbd") {
        const value = text(n).trim();
        const fence = "`".repeat(
          Math.max(
            1,
            ...[...value.matchAll(/`+/g)].map((m) => m[0].length + 1),
          ),
        );
        return `${fence} ${value} ${fence}`;
      }
      if (tag === "table") {
        stats.tables++;
        const rows = [];
        walk(n, (r) => {
          if (r.tagName === "tr") rows.push(r);
        });
        const richCells = await Promise.all(rows.map(r => Promise.all(children(r).filter(c => ['td','th'].includes(c.tagName)).map(async c => ({
          body: (await renderChildren(c)).trim(), header: c.tagName === 'th', rowSpan: Number(attr(c,'rowspan') || 1), colSpan: Number(attr(c,'colspan') || 1)
        })))));
        // GFM tables cannot express cell line breaks, block content or spans.
        // Retain those cells as nested Markdown instead of inserting punctuation.
        if (richCells.some(row => row.some(c => c.rowSpan !== 1 || c.colSpan !== 1 || c.body.includes('\n'))))
          return anchor + structured('table', { rows: richCells });
        const cells = richCells.map(row => row.map(c => c.body.replace(/\|/g, '\\|')));
        const width = Math.max(0, ...cells.map((c) => c.length));
        if (!width) return "";
        const padded = cells.map((c) => [
          ...c,
          ...Array(width - c.length).fill(""),
        ]);
        return `\n\n| ${padded[0].join(" | ")} |\n| ${Array(width).fill("---").join(" | ")} |\n${padded
          .slice(1)
          .map((c) => "| " + c.join(" | ") + " |")
          .join("\n")}\n\n`;
      }
      if (tag === "a" || tag === "img") {
        const href = attr(n, tag === "img" ? "src" : "href");
        const label =
          tag === "img"
            ? escape(attr(n, "alt"))
            : (await renderChildren(n)).trim();
        if (/^https?:\/\//.test(href))
          return tag === "img"
            ? `[插图：${label}](${href})`
            : `[${label}](${href})`;
        if (!href || /^(javascript:|data:|mailto:)/i.test(href)) return label;
        const [rel, fragment] = href.split("#");
        const file = path.resolve(
          path.dirname(source.file),
          decodeURIComponent(rel || path.basename(source.file)),
        );
        const target = targets.get(`${file}#${fragment}`) || targets.get(file);
        if (target) return `[${label}](doc:${target})`;
        if(path.basename(file)==='volumes.html')return ''; // The app supplies course navigation.
        try {
          const asset = await attachment(file);
          if (asset)
            return `${tag === "img" ? "!" : ""}[${label || path.basename(file)}](${asset})`;
        } catch {
          /* Report unavailable local references without inventing a destination. */
        }
        unresolved.push({ chapter: chapter.id, href, label });
        return label;
      }
      let value = await renderChildren(n);
      if (/^h[1-6]$/.test(tag || ""))
        return `${anchor}\n\n${"#".repeat(Math.min(6, Math.max(2, Number(tag[1]))))} ${value.trim().replace(/\s*\n\s*/g, ' ')}\n\n`;
      if (tag === "summary") return `\n\n### ${value.trim()}\n\n`;
      if (tag === "strong" || tag === "b")
        return value.trim() ? ` **${value.trim()}** ` : "";
      if (tag === "em" || tag === "i")
        return value.trim() ? ` *${value.trim()}* ` : "";
      if (tag === "br") return "  \n";
      if (tag === "hr") return "\n\n---\n\n";
      if (tag === "li")
      {
        const parent = n.parentNode;
        const marker = parent?.tagName === 'ol'
          ? `${Number(attr(parent, 'start') || 1) + children(parent).filter(c => c.tagName === 'li').indexOf(n)}.` : '-';
        return `\n${marker} ` + value.trim().replace(/\n/g, '\n' + ' '.repeat(marker.length + 1)) + '\n';
      }
      if (["ul", "ol"].includes(tag)) return "\n\n" + value + "\n\n";
      if (tag === "blockquote")
        return (
          "\n\n" +
          value
            .trim()
            .split("\n")
            .map((l) => "> " + l)
            .join("\n") +
          "\n\n"
        );
      if (
        [
          "p",
          "div",
          "section",
          "article",
          "details",
          "figure",
          "figcaption",
          "header",
          "aside",
          "dl",
          "dt",
          "dd",
        ].includes(tag)
      )
        return `${anchor}\n\n${value.trim()}\n\n`;
      return anchor + value;
    }
    let body = await render(readingRoot);
    for (const extra of source.chapterExtras?.get(chapter.anchor) || []) body += await render(extra);
    // Never normalize blank lines across fenced code: they are part of the
    // original listing/transcript and must survive a copy or export verbatim.
    body = body.trim();
    body = `# ${chapter.title}\n\n${body}\n`;
    body = annotateTerms(body);
    // Corrections are applied to the imported copy only. The prototype is left intact.
    body = body
      .replaceAll("堆：200 字节", "堆：512 字节（0x200）")
      .replaceAll("3 个半字：f3ef 8305", "2 个半字：f3ef 8305，共 4 字节")
      .replaceAll(
        '这就是"__get_IPSR() 不是函数"的硬证据：它连一次跳转都不发生。',
        "这说明此处的内联访问器没有生成独立的 BL 调用；不能据此说 C 层的 __get_IPSR 不是函数。",
      )
      .replaceAll(
        "调用未初始化的函数指针；跳到奇数地址",
        "异常返回时使用无效的 EXC_RETURN 或返回状态不满足完整性检查；不能仅凭目标地址奇偶判断 INVPC",
      )
      .replace(
        /必须是向量表的第二个字（偏移 `\s*0x04\s*`）/g,
        "必须是向量表的第一个字（偏移 `0x00`）",
      )
      .replace(
        /必须是向量表偏移 `\s*0x04\s*` 处的第二个字/g,
        "必须是向量表偏移 `0x00` 处的第一个字",
      );
    if (chapter.id === "book-b01-01")
      body +=
        "\n\n## 校读说明\n\n本次整理修正了堆大小的十六进制换算、MRS 指令半字数量，以及内联函数与调用指令的区别。Cortex-M 向量表的首个 32 位字是初始 MSP，第二个字是 Reset_Handler；函数指针中的 Thumb 状态位不等同于实际取指地址。\n\n参考：[CMSIS 启动文件](https://arm-software.github.io/CMSIS_5/Core/html/startup_c_pg.html)、[CMSIS 核心寄存器访问](https://arm-software.github.io/CMSIS_6/main/Core/group__Core__Register__gr.html)。\n";
    if(chapter.kind==='chapter')body += `\n\n---\n\n[本册导读、实验资料与完整学习规划](doc:${book.overviewId})\n`;
    if(chapter.id==='course-projects')body+='\n\n[下载六项项目的完整工程包](textbook-file:projects.zip)\n';
    await fs.writeFile(path.join(output, chapter.file), body);
    chapter.characters = body.length;
    reports.push({ ...stats, characters: body.length, sha256: digest(body) });
  }
}
await fs.writeFile(
  path.join(output, "catalog.json"),
  JSON.stringify(curriculum, null, 2),
);
await fs.writeFile(
  path.join(output, "import-report.json"),
  JSON.stringify(
    {
      sourceVersion: curriculum.version,
      books: curriculum.books.length,
      readableBooks: curriculum.books.length,
      chapters: reports,
      assets: [...assets.values()],
      unresolved,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    books: curriculum.books.length,
    chapters: reports.length,
    assets: assets.size,
    unresolved: unresolved.length,
    figures: reports.reduce((s, c) => s + c.figures, 0),
    tables: reports.reduce((s, c) => s + c.tables, 0),
  }),
);
