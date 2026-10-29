import { describe, expect, it } from "vitest";
import { simulateThermal } from "../src/thermalModel";
import catalog from "../content/textbooks/catalog.json";
import seed from "../public/seed/catalog.json";
import { internalLinks } from "../src/links";

describe("textbook migration", () => {
  it("has all reviewed chapters, unique IDs and resolvable nested links", () => {
    expect(catalog.books).toHaveLength(27);
    expect(catalog.books.reduce((sum,b)=>sum+b.chapters.length,0)).toBe(407);
    expect(seed.shelves.filter(s => s.kind === "course")).toHaveLength(28);
    expect(seed.articles.some(a => /^(book-|cpp-|linux-)/.test(a.id))).toBe(false);
    const ids = new Set(seed.articles.map((a) => a.id));
    expect(ids.size).toBe(seed.articles.length);
    for (const b of catalog.books) {
      expect(ids.has(b.overviewId)).toBe(true);
      for (const pre of b.prerequisites)
        expect(catalog.books.some((b) => b.id === pre)).toBe(true);
      for (const c of b.chapters) expect(ids.has(c.id)).toBe(true);
      for (const module of b.modules) expect(b.chapters.some(c => c.id === module.articleId)).toBe(true);
    }
    for (const a of seed.articles.filter((a) => a.id.startsWith("course-"))) {
      expect(a.body).not.toContain("textbook-file:");
      for (const link of internalLinks(a.body)) {
        if (link.kind === "doc") expect(ids.has(link.id)).toBe(true);
      }
    }
  }, 20000); // Parses the complete 27-book corpus, including nested Markdown.
});
describe("PI model transferred from prototype", () => {
  it("settles near target and never commands an out-of-range actuator", () => {
    const rows = simulateThermal();
    expect(rows).toHaveLength(1201);
    expect(Math.abs(rows.at(-1)!.temperature - 45)).toBeLessThan(0.2);
    expect(rows.every((r) => r.output >= 0 && r.output <= 1)).toBe(true);
  });
  it("fault latches and anti-windup reduces accumulated integral during unattainable setpoint", () => {
    expect(
      simulateThermal({ scenario: "sensor-fault" })
        .filter((r) => r.t >= 70)
        .every((r) => r.fault && r.output === 0),
    ).toBe(true);
    const peak = (antiWindup: boolean) =>
      Math.max(
        ...simulateThermal({ scenario: "recovery", antiWindup }).map((r) =>
          Math.abs(r.integral),
        ),
      );
    expect(peak(true)).toBeLessThan(peak(false));
  });
  it("rejects invalid model parameters", () => {
    expect(() => simulateThermal({ tau: 0 })).toThrow();
    expect(() => simulateThermal({ kp: NaN })).toThrow();
  });
});
