import { expect, it } from "vitest";
import fs from "node:fs";
// @ts-expect-error Build-time annotation intentionally uses plain JavaScript.
import { annotateTerms } from "../scripts/annotate-terms.mjs";
import terms from "../content/glossary.json";

it("annotates concepts once, without changing code, diagrams, headings or existing links", () => {
  const untouched =
    "# OTA\n\n`OTA`\n\n```mermaid\nA[OTA] --> B[DMA]\n```\n\n[DMA](asset:test)\n\n";
  const body =
    untouched + "OTA uses DMA. OTA_BOOT is an identifier. DMA again.\n";
  expect(annotateTerms(body)).toBe(
    untouched +
      "[OTA](term:ota) uses [DMA](term:dma). OTA_BOOT is an identifier. DMA again.\n",
  );
});
it("preserves explicit annotations and is idempotent on repeated imports", () => {
  const body = "[事务](term:transaction) 与事务。所有权和 owner 一致。\n";
  const result = annotateTerms(body);
  expect(result).toBe(
    "[事务](term:transaction) 与事务。[所有权](term:ownership)和 owner 一致。\n",
  );
  expect(annotateTerms(result)).toBe(result);
});
it("keeps English identifiers intact and matches punctuation and Chinese text", () => {
  expect(annotateTerms("OTA_BOOT xDMA DMA2 before ACK，DMA 与 PCM16。")).toBe(
    "OTA_BOOT xDMA DMA2 before [ACK](term:ack)，[DMA](term:dma) 与 [PCM16](term:pcm)。",
  );
});
it("resolves every term, related concept and chapter in the shipped content", () => {
  const catalog = JSON.parse(
    fs.readFileSync("public/seed/catalog.json", "utf8"),
  );
  const ids = new Set(catalog.articles.map((a: { id: string }) => a.id));
  for (const term of Object.values(terms)) {
    expect(ids.has(term.chapter)).toBe(true);
    for (const related of term.related)
      expect(Object.hasOwn(terms, related)).toBe(true);
  }
  for (const a of catalog.articles)
    for (const m of a.body.matchAll(/\]\(term:([^)]*)\)/g))
      expect(Object.hasOwn(terms, m[1])).toBe(true);
});
