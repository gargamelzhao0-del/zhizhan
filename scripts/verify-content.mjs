import fs from "node:fs/promises";
import { verifySeedIntegrity, verifyHandbookReading } from "./content-integrity.mjs";
const catalog = JSON.parse(
  await fs.readFile("public/seed/catalog.json", "utf8"),
);
const articleIds = new Set(catalog.articles.map((a) => a.id)),
  assetIds = new Set(catalog.attachments.map((a) => a.id)),
  issues = [];
const learningCoverage = [];
const handbookCoverage = [];
const glossary = JSON.parse(await fs.readFile("content/glossary.json", "utf8"));
let termLinks = 0, diagrams = 0, knowledgeMaps = 0;
for (const [id, term] of Object.entries(glossary)) {
  if (!articleIds.has(term.chapter)) issues.push(`term:${id}: missing chapter`);
  for (const related of term.related) if (!Object.hasOwn(glossary, related)) issues.push(`term:${id}: missing related ${related}`);
}
for (const a of catalog.articles) {
  for (const match of a.body.matchAll(/\]\(term:([^)]*)\)/g)) {
    termLinks++;
    if (!Object.hasOwn(glossary, match[1])) issues.push(`${a.id}: unknown term:${match[1]}`);
  }
  if (/<!-- example:/.test(a.body)) issues.push(`${a.id}: unexpanded example`);
  if (/^(cpp|linux|lessons)-/.test(a.id)) {
    const coverage = {
      id: a.id,
      characters: a.body.length,
      goals: /目标/.test(a.body),
      practice: /练习|实验|结课/.test(a.body),
      verification: /验收|通过条件|完成条件/.test(a.body),
      answers: /自测|答案/.test(a.body),
    };
    learningCoverage.push(coverage);
    if (
      !coverage.goals ||
      !coverage.practice ||
      !coverage.verification ||
      !coverage.answers
    )
      issues.push(`${a.id}: learning structure incomplete`);
  }
  if (a.id.startsWith("handbook-")) {
    const count = [...a.body.matchAll(/```mermaid\r?\n/g)].length;
    diagrams += count;
    if (/```zhizhan-map\r?\n/.test(a.body)) knowledgeMaps++;
    else issues.push(`${a.id}: missing knowledge map`);
    handbookCoverage.push({
      id: a.id,
      characters: a.body.length,
      goals: /学习目标|目标：/.test(a.body),
      practice: /练习|实验|自测/.test(a.body),
      verification: /验收|通过条件|完成条件|预期/.test(a.body),
      answers: /参考答案|答案|预期结果/.test(a.body),
    });
  }
  for (const m of a.body.matchAll(/\b(doc|asset):([\w-]+)/g)) {
    if (!(m[1] === "doc" ? articleIds : assetIds).has(m[2]))
      issues.push(`${a.id}: missing ${m[0]}`);
  }
}
const source = JSON.parse(await fs.readFile("docs/seed-report.json", "utf8"));
const curriculum = JSON.parse(await fs.readFile("content/curriculum.json", "utf8"));
for (const [shelf, course] of Object.entries(curriculum)) {
  // The project path covers every chapter; language-course overviews are separate.
  if (shelf !== "handbook") continue;
  const assigned = course.modules.flatMap(module => module.lessons);
  const expected = catalog.articles.filter(article => article.shelfId === shelf).map(article => article.id);
  if (new Set(assigned).size !== assigned.length) issues.push(`${shelf}: duplicated learning-path chapter`);
  for (const id of expected) if (!assigned.includes(id)) issues.push(`${shelf}: chapter missing from learning path: ${id}`);
  for (const id of assigned) if (!expected.includes(id)) issues.push(`${shelf}: unexpected learning-path chapter: ${id}`);
}
issues.push(...await verifySeedIntegrity(catalog, source, (file) => fs.readFile(`public/seed/${file}`)));
issues.push(...verifyHandbookReading(catalog, source));
const result = {
  date: source.date,
  checkedAt: new Date().toISOString(),
  articles: articleIds.size,
  attachments: assetIds.size,
  glossaryTerms: Object.keys(glossary).length,
  termLinks,
  handbookDiagrams: diagrams,
  knowledgeMaps,
  issues,
  knownExclusions: source.warnings,
  learningCoverage,
  handbookCoverage,
  handbookCoverageNote: "Diagnostic inventory, not a pass/fail teaching score. Baseline and index chapters have different roles; remaining depth requires manual review.",
  note: "Structure and reference checks support review; they do not certify factual quality or target-device execution.",
};
await fs.writeFile(
  "docs/content-validation.json",
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result));
if (issues.length) process.exitCode = 1;
