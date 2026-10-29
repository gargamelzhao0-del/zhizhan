import { expect, it } from "vitest";
import { VaultDB } from "../src/db";
import { articleDefaults } from "../src/model";
import { retireOutdatedTutorials } from "../src/retiredTutorials";

it("retires bundled originals and tracked replacements, preserving notes and user-created work", async () => {
  const db = new VaultDB(`retirement-${crypto.randomUUID()}`);
  try {
    await db.articles.bulkAdd([
      { ...articleDefaults("cpp"), id: "cpp-01", note: "我的笔记", favorite: true, progress: 50 },
      { ...articleDefaults("book-b00"), id: "replacement", body: "个人修订" },
      { ...articleDefaults("cpp"), id: "my-own-course", body: "自建文章" },
      { ...articleDefaults("handbook"), id: "handbook-01" },
    ]);
    await db.settings.put({ key: "builtinContent", value: { articles: { "book-b00-01": { targetId: "replacement" } } } });
    expect(await retireOutdatedTutorials(db)).toBe(2);
    expect(await db.articles.get("cpp-01")).toMatchObject({ note: "我的笔记", favorite: true, progress: 50 });
    expect((await db.articles.get("cpp-01"))!.deletedAt).toBeGreaterThan(0);
    expect((await db.articles.get("replacement"))!.deletedAt).toBeGreaterThan(0);
    expect((await db.articles.get("my-own-course"))!.deletedAt).toBe(0);
    expect((await db.articles.get("handbook-01"))!.deletedAt).toBe(0);
    await db.articles.update("cpp-01", { deletedAt: 0 });
    expect(await retireOutdatedTutorials(db)).toBe(0);
    expect((await db.articles.get("cpp-01"))!.deletedAt).toBe(0);
  } finally { await db.delete(); }
});
