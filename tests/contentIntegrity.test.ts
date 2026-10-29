import { expect, it } from "vitest";
import { createHash } from "node:crypto";
// @ts-expect-error Build-time validation scripts intentionally use plain JavaScript.
import { verifySeedIntegrity, verifyHandbookReading, handbookReadingRequirements } from "../scripts/content-integrity.mjs";

function fixture() {
  const bytes = Buffer.from("print('complete example')\n");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const ref = { id: "source-" + "a".repeat(24), name: "example.py", mime: "text/plain", path: `assets/source-${"a".repeat(24)}-${sha256.slice(0,16)}.bin`, sha256 };
  return { catalog: { articles: [{ id: "handbook-23", body: "" }], attachments: [{ ...ref }] },
    source: { assets: [{ ...ref, bytes: bytes.length, source: "example.py" }] }, read: async () => bytes };
}

it("accepts consistent App manifest, import record and bytes", async () => {
  const f = fixture();
  expect(await verifySeedIntegrity(f.catalog, f.source, f.read)).toEqual([]);
});
it("rejects App-only hash corruption even when the import report matches disk", async () => {
  const f = fixture(); f.catalog.attachments[0].sha256 = "0".repeat(64);
  const issues = await verifySeedIntegrity(f.catalog, f.source, f.read);
  expect(issues.some((x: string) => x.includes("Catalog hash mismatch"))).toBe(true);
  expect(issues.some((x: string) => x.includes("Catalog/report sha256 mismatch"))).toBe(true);
});
it("rejects stale bytes and filename hashes", async () => {
  const f = fixture();
  const issues = await verifySeedIntegrity(f.catalog, f.source, async () => Buffer.from("stale"));
  expect(issues.some((x: string) => x.includes("Catalog hash mismatch"))).toBe(true);
  expect(issues.some((x: string) => x.includes("filename hash mismatch"))).toBe(true);
});
it("reports missing files without abandoning the full check", async () => {
  const f = fixture();
  expect(await verifySeedIntegrity(f.catalog, f.source, async () => { throw Error("missing"); })).toEqual([`Missing or unreadable asset: ${f.catalog.attachments[0].path}`]);
});
it("rejects duplicates and missing import entries", async () => {
  const f = fixture(); f.catalog.articles.push(f.catalog.articles[0]); f.catalog.attachments.push(f.catalog.attachments[0]); f.source.assets = [];
  const issues = await verifySeedIntegrity(f.catalog, f.source, f.read);
  expect(issues.some((x: string) => x.startsWith("Duplicate article"))).toBe(true);
  expect(issues.some((x: string) => x.startsWith("Duplicate attachment"))).toBe(true);
  expect(issues.some((x: string) => x.startsWith("Missing import record"))).toBe(true);
});
it("never reads an unsafe route", async () => {
  const f = fixture(); f.catalog.attachments[0].path = "../private.txt";
  let reads = 0;
  const issues = await verifySeedIntegrity(f.catalog, f.source, async () => { reads++; return Buffer.alloc(0); });
  expect(reads).toBe(0); expect(issues[0]).toContain("unsafe");
});
it("requires examples to be linked from their lesson, not just present in the bundle", () => {
  const articles: {id: string; body: string}[] = [], assets: {id: string; source: string}[] = [];
  for (const [id, paths] of Object.entries(handbookReadingRequirements) as [string, string[]][]) {
    const refs = paths.map((source) => {
      const existing = assets.find(asset => asset.source === source);
      if (existing) return existing;
      const ref = { id: `source-${assets.length}`, source };
      assets.push(ref);
      return ref;
    });
    articles.push({ id, body: refs.map(r => `[源码](asset:${r.id})`).join("\n") });
  }
  expect(verifyHandbookReading({ articles }, { assets })).toEqual([]);
  articles.find(a => a.id === "handbook-23")!.body = "运行 examples/audio_budget.py";
  expect(verifyHandbookReading({ articles }, { assets })).toHaveLength(handbookReadingRequirements["handbook-23"].length);
});
