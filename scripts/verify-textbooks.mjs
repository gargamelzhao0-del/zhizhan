import fs from "node:fs/promises";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfm } from "micromark-extension-gfm";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { createHash } from "node:crypto";
const registry = JSON.parse(
  await fs.readFile("content/textbooks/catalog.json", "utf8"),
);
const source = JSON.parse(
  await fs.readFile("content/textbooks/import-report.json", "utf8"),
);
const seed = JSON.parse(await fs.readFile("public/seed/catalog.json", "utf8"));
const issues = [],
  chapters = [];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const treeOf = body => fromMarkdown(body, { extensions:[gfm()], mdastExtensions:[gfmFromMarkdown()] });
function visitAll(node, fn) {
  fn(node);
  if(node.type==='code' && ['zhizhan-details','zhizhan-table'].includes(node.lang)) {
    const data=JSON.parse(node.value);
    const bodies=node.lang==='zhizhan-details' ? [data.body] : data.rows.flat().map(cell=>cell.body);
    for(const body of bodies)visitAll(treeOf(body),fn);
  }
  node.children?.forEach(child=>visitAll(child,fn));
}
const articleMap=new Map(seed.articles.map(a=>[a.id,a]));
const anchors=new Map(seed.articles.map(a=>{
  const ids=new Set(); visitAll(treeOf(a.body),n=>{if(n.type==='code'&&n.lang==='zhizhan-anchor')ids.add(n.value.trim());});
  return [a.id,ids];
}));
const documents=[...registry.books.flatMap(b=>[...b.chapters,b.guide]),...registry.auxiliary];
let assessments=0,details=0,spanTables=0,structuredTables=0;
for (const chapter of documents) {
  const body=await fs.readFile(`content/textbooks/${chapter.file}`,'utf8');
  const sourceRow=source.chapters.find(c=>c.id===chapter.id);
  const row={id:chapter.id,kind:chapter.kind,figures:0,code:0,tables:0};
  visitAll(treeOf(body),n=>{
    if(n.type==='code') {
      if(n.lang==='zhizhan-figure')row.figures++;
      else if(n.lang==='zhizhan-table'){
        row.tables++;structuredTables++;
        if(JSON.parse(n.value).rows.some(r=>r.some(c=>c.rowSpan>1||c.colSpan>1)))spanTables++;
      }
      else if(n.lang==='zhizhan-details')details++;
      else if(n.lang==='zhizhan-assessment')assessments++;
      else if(!n.lang?.startsWith('zhizhan-'))row.code++;
    }
    if(n.type==='table')row.tables++;
    if(n.type==='link'&&n.url.startsWith('doc:')) {
      const [id,fragment]=n.url.slice(4).split('#');
      if(!articleMap.has(id))issues.push(`${chapter.id}: missing document ${id}`);
      else if(fragment&&!anchors.get(id)?.has(fragment))issues.push(`${chapter.id}: missing source anchor ${id}#${fragment}`);
    }
  });
  for(const field of ['figures','tables','code'])
    if(row[field]!==sourceRow[field])issues.push(`${chapter.id}: ${field} HTML ${sourceRow[field]}, Markdown ${row[field]}`);
  if(hash(body)!==sourceRow.sha256)issues.push(`${chapter.id}: source snapshot hash mismatch`);
  if(!body.trim())issues.push(`${chapter.id}: empty imported section`);
  chapters.push(row);
}
if(source.unresolved.length)issues.push(...source.unresolved.map(x=>`${x.chapter}: unresolved ${x.href}`));
if(assessments!==317)issues.push(`Expected 317 assessments, found ${assessments}`);
for (const a of seed.attachments)
  if (hash(await fs.readFile(`public/seed/${a.path}`)) !== a.sha256)
    issues.push(`Asset checksum: ${a.id}`);
const report = {
  checkedAt: new Date().toISOString(),
  books: registry.books.length,
  readableBooks: registry.books.filter((b) => b.chapters.length).length,
  chapterCount: chapters.filter(c=>c.kind==='chapter').length,
  guideCount: registry.books.length,
  resourcePages: registry.auxiliary.length,
  assessments, details, spanTables, structuredTables,
  figures: chapters.reduce((s, c) => s + c.figures, 0),
  tables: chapters.reduce((s, c) => s + c.tables, 0),
  code: chapters.reduce((s, c) => s + c.code, 0),
  chapters,
  issues,
  note: "Checks migration integrity and references, not every factual statement or target-board execution.",
};
await fs.writeFile(
  "docs/textbook-integrity-report.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify({ ...report, chapters: undefined }));
if (issues.length) process.exitCode = 1;
