import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { VaultDB, saveArticle, saveNote, advanceProgress } from "../src/db";
import { importMarkdown } from "../src/importMarkdown";
import { internalLinks, rewriteLinks } from "../src/links";
import {
  articleDefaults,
  nextReview,
  searchArticles,
  type Shelf,
} from "../src/model";
import {
  exportArchive,
  inspectArchive,
  importArchive,
  unzipBounded,
} from "../src/archive";
import { zipSync, strToU8 } from "fflate";
let database: VaultDB;
const shelf: Shelf = {
  id: "shelf-test",
  title: "项目",
  description: "说明",
  kind: "project",
  color: "#386557",
  createdAt: 1,
};
beforeEach(async () => {
  database = new VaultDB(`test-${crypto.randomUUID()}`);
  await database.shelves.add(shelf);
});
afterEach(async () => {
  await database.delete();
});
async function seed() {
  const a = {
    ...articleDefaults(shelf.id, "队列容量"),
    id: "article-a",
    body: "## 队列\n\n中断 SD 卡 [源码](asset:file-a)",
    note: "我的证据",
    favorite: true,
    progress: 50,
    reviewAt: 100,
  };
  await database.articles.add(a);
  await database.attachments.add({
    id: "file-a",
    name: "driver.c",
    mime: "text/plain",
    data: new Blob(["int x=1;"]),
    size: 8,
  });
  return a;
}
describe("Local storage and portable backup", () => {
  it("round trips binary files, content, notes, progress, history and links", async () => {
    const a = await seed();
    await saveArticle({ ...a, body: a.body + "\n新内容" }, a.version, database);
    const blob = await exportArchive(database);
    const pkg = await inspectArchive(blob);
    expect(pkg.manifest.articles[0].note).toBe("我的证据");
    expect(pkg.manifest.revisions).toHaveLength(1);
    const target = new VaultDB(`target-${crypto.randomUUID()}`);
    try {
      const result = await importArchive(pkg, target);
      expect(result.added).toBe(1);
      expect(await (await target.attachments.get("file-a"))!.data.text()).toBe(
        "int x=1;",
      );
      expect((await target.articles.get("article-a"))!.body).toContain(
        "asset:file-a",
      );
    } finally {
      await target.delete();
    }
  });
  it("skips an identical import and preserves conflicting data as a separate copy", async () => {
    const a = await seed();
    const pkg = await inspectArchive(await exportArchive(database));
    expect((await importArchive(pkg, database)).skipped).toBe(1);
    await saveArticle({ ...a, body: "本地新版本" }, a.version, database);
    const result = await importArchive(pkg, database);
    expect(result.copies).toBe(1);
    expect((await database.articles.get("article-a"))!.body).toBe("本地新版本");
    expect(await database.articles.count()).toBe(2);
  });
  it("rejects a stale editor without destroying either version", async () => {
    const a = await seed();
    await saveArticle({ ...a, body: "窗口 A" }, 1, database);
    await expect(
      saveArticle({ ...a, body: "窗口 B" }, 1, database),
    ).rejects.toThrow("另一窗口");
    expect((await database.articles.get(a.id))!.body).toBe("窗口 A");
  });
  it("does not overwrite notes or bookmarks while saving a stale editor metadata snapshot", async () => {
    const a = await seed();
    await database.articles.update(a.id, {
      note: "稍后保存的笔记",
      favorite: false,
    });
    await saveArticle({ ...a, body: "正文变更" }, 1, database);
    const saved = await database.articles.get(a.id);
    expect(saved!.note).toBe("稍后保存的笔记");
    expect(saved!.favorite).toBe(false);
  });
  it("keeps only the last 30 edit revisions", async () => {
    let a = await seed();
    for (let n = 0; n < 35; n++)
      a = await saveArticle({ ...a, title: `版本${n}` }, a.version, database);
    expect(await database.revisions.count()).toBe(30);
  });
  it("rejects corrupt attachment bytes before any storage mutation", async () => {
    await seed();
    const entries = unzipBounded(
      new Uint8Array(await (await exportArchive(database)).arrayBuffer()),
    );
    entries["assets/file-a/driver.c"] = strToU8("tampered");
    const blob = new Blob([new Uint8Array(zipSync(entries))]);
    await expect(inspectArchive(blob)).rejects.toThrow("损坏");
    expect(await database.articles.count()).toBe(1);
  });
  it("rejects unsupported versions, orphan shelves and malformed fields", async () => {
    await seed();
    const entries = unzipBounded(
      new Uint8Array(await (await exportArchive(database)).arrayBuffer()),
    );
    const manifest = JSON.parse(
      new TextDecoder().decode(entries["manifest.json"]),
    );
    manifest.version = 2;
    entries["manifest.json"] = strToU8(JSON.stringify(manifest));
    await expect(
      inspectArchive(new Blob([new Uint8Array(zipSync(entries))])),
    ).rejects.toThrow("版本");
    manifest.version = 1;
    manifest.articles[0].shelfId = "missing";
    entries["manifest.json"] = strToU8(JSON.stringify(manifest));
    await expect(
      inspectArchive(new Blob([new Uint8Array(zipSync(entries))])),
    ).rejects.toThrow("文章字段");
  });
  it("rejects path traversal and stops excessive decompression", () => {
    expect(() => unzipBounded(zipSync({ "../outside": strToU8("x") }))).toThrow(
      "路径",
    );
    expect(() =>
      unzipBounded(zipSync({ huge: new Uint8Array(25 * 1024 * 1024) })),
    ).toThrow("容量");
  });
  it("exported markdown refers to standalone local files", async () => {
    await seed();
    const entries = unzipBounded(
      new Uint8Array(await (await exportArchive(database)).arrayBuffer()),
    );
    expect(
      new TextDecoder().decode(entries["markdown/article-a.md"]),
    ).toContain("../assets/file-a/driver.c");
  });
});
describe("Learning behavior", () => {
  it("keeps GFM formatting in link labels when remapping destinations", () => {
    const markdown =
      "| 资料 |\n| --- |\n| [~~旧接口~~](doc:old) |\n\n`doc:old`";
    const result = rewriteLinks(markdown, (url) =>
      url === "doc:old" ? "doc:copy" : url,
    );
    expect(result).toContain("[~~旧接口~~](doc:copy)");
    expect(result).toContain("`doc:old`");
    expect(result).toContain("| --- |");
  });
  it("preserves a linked course including cycles when one target conflicts", async () => {
    const a = {
      ...articleDefaults(shelf.id, "目录"),
      id: "a",
      body: "[下一章](doc:b#原理)",
    };
    const b = {
      ...articleDefaults(shelf.id, "原理"),
      id: "b",
      body: "[实验][lab]\n\n[lab]: doc:c",
    };
    const c = {
      ...articleDefaults(shelf.id, "实验"),
      id: "c",
      body: "[回目录](doc:a)\n\n旧实验",
    };
    await database.articles.bulkAdd([a, b, c]);
    const pkg = await inspectArchive(await exportArchive(database));
    await saveArticle({ ...c, body: "本地新实验" }, c.version, database);
    const result = await importArchive(pkg, database);
    expect(result.copies).toBe(3);
    const copies = (await database.articles.toArray()).filter(
      (x) => !["a", "b", "c"].includes(x.id),
    );
    const ca = copies.find((x) => x.title.startsWith("目录"))!;
    const cb = copies.find((x) => x.title.startsWith("原理"))!;
    const cc = copies.find((x) => x.title.startsWith("实验"))!;
    expect(internalLinks(ca.body)).toEqual([{ kind: "doc", id: cb.id }]);
    expect(ca.body).toContain("#原理");
    expect(internalLinks(cb.body)).toEqual([{ kind: "doc", id: cc.id }]);
    expect(internalLinks(cc.body)).toEqual([{ kind: "doc", id: ca.id }]);
    expect((await database.articles.get("a"))!.body).toBe(a.body);
    expect((await database.articles.get("c"))!.body).toBe("本地新实验");
  });
  it("keeps conflict-copy titles within the limits of the next backup", async () => {
    const a = { ...articleDefaults(shelf.id, "长".repeat(300)), id: "long" };
    await database.articles.add(a);
    const pkg = await inspectArchive(await exportArchive(database));
    await saveArticle({ ...a, body: "本机修改" }, 1, database);
    await importArchive(pkg, database);
    const checked = await inspectArchive(await exportArchive(database));
    expect(checked.manifest.articles).toHaveLength(2);
    expect(
      checked.manifest.articles.every((item) => item.title.length <= 300),
    ).toBe(true);
  });
  it("rewrites Markdown destinations and reference definitions without touching code examples", () => {
    const body =
      '文字 asset:file-a\n\n`[例子](asset:file-a)`\n\n```md\n[源码](asset:file-a)\n```\n\n[真实][ref]\n\n[ref]: asset:file-a "标题"\n\n[![插图](asset:image)](doc:chapter#小节)';
    const rewritten = rewriteLinks(body, (url) =>
      url.replace("asset:file-a", "asset:copy"),
    );
    expect(rewritten).toContain("文字 asset:file-a");
    expect(rewritten).toContain("`[例子](asset:file-a)`");
    expect(rewritten).toContain("```md\n[源码](asset:file-a)\n```");
    expect(rewritten).toContain('[ref]: asset:copy "标题"');
    expect(internalLinks(rewritten)).toHaveLength(3);
  });
  it("imports reference-style destinations, filename parentheses and anchors without changing fenced code", async () => {
    const result = await importMarkdown(
      [
        new File(
          [
            "# 第一章\n\n```md\n[模板](second.md)\n```\n\n[第二章][next]\n\n[next]: second.md#章节\n\n![图片](<image (1).png>)",
          ],
          "first.md",
        ),
        new File(["# 第二章\n\n## 章节"], "second.md"),
        new File([new Uint8Array([1, 2])], "image (1).png", {
          type: "image/png",
        }),
      ],
      database,
    );
    const imported = await database.articles
      .where("shelfId")
      .equals(result.shelfId)
      .toArray();
    const a = imported.find((x) => x.title === "第一章")!;
    const b = imported.find((x) => x.title === "第二章")!;
    expect(a.body).toContain("```md\n[模板](second.md)\n```");
    expect(a.body).toContain(`doc:${b.id}#章节`);
    expect(
      internalLinks(a.body)
        .map((ref) => ref.kind)
        .sort(),
    ).toEqual(["asset", "doc"]);
  });
  it("does not let an older scroll update replace a completed or more advanced reading position", async () => {
    const a = await seed();
    await advanceProgress(a.id, 70, database);
    await advanceProgress(a.id, 60, database);
    expect((await database.articles.get(a.id))!.progress).toBe(70);
    await database.articles.update(a.id, { progress: 100 });
    await advanceProgress(a.id, 99, database);
    expect((await database.articles.get(a.id))!.progress).toBe(100);
  });
  it("never treats a legacy recovery draft with unknown base as a newer saved note", async () => {
    const a = await seed();
    await expect(saveNote(a.id, "旧草稿", null, database)).rejects.toThrow(
      "另一窗口",
    );
    expect((await database.articles.get(a.id))!.note).toBe(a.note);
    await saveNote(a.id, a.note, null, database);
  });
  it("escapes spaces and fragments in standalone attachment links", async () => {
    await seed();
    await database.attachments.update("file-a", { name: "my notes #1.c" });
    const entries = unzipBounded(
      new Uint8Array(await (await exportArchive(database)).arrayBuffer()),
    );
    expect(
      new TextDecoder().decode(entries["markdown/article-a.md"]),
    ).toContain("../assets/file-a/my%20notes%20%231.c");
    expect(entries["assets/file-a/my notes #1.c"]).toBeDefined();
  });
  it("rolls back the entire import if a later article cannot be written", async () => {
    await seed();
    const extra = { ...articleDefaults(shelf.id, "第二篇"), id: "article-b" };
    await database.articles.add(extra);
    const pkg = await inspectArchive(await exportArchive(database));
    const target = new VaultDB(`rollback-${crypto.randomUUID()}`);
    try {
      target.articles.hook("creating", (_key, article) => {
        if (article.id === "article-b")
          throw new Error("simulated disk failure");
      });
      await expect(importArchive(pkg, target)).rejects.toThrow("simulated");
      expect(await target.articles.count()).toBe(0);
      expect(await target.shelves.count()).toBe(0);
      expect(await target.attachments.count()).toBe(0);
    } finally {
      await target.delete();
    }
  });
  it("copies an unchanged article when its attachment identity conflicts", async () => {
    const a = await seed();
    const pkg = await inspectArchive(await exportArchive(database));
    await database.attachments.update("file-a", {
      data: new Blob(["new bytes"]),
      size: 9,
    });
    const result = await importArchive(pkg, database);
    expect(result.copies).toBe(1);
    const copy = (await database.articles.toArray()).find(
      (x) => x.id !== a.id,
    )!;
    expect(copy.body).not.toContain("asset:file-a");
    const assetId = copy.body.match(/asset:([\w-]+)/)![1];
    expect(await (await database.attachments.get(assetId))!.data.text()).toBe(
      "int x=1;",
    );
  });
  it("rejects truncated zip archives", async () => {
    await seed();
    const blob = await exportArchive(database);
    await expect(inspectArchive(blob.slice(0, blob.size - 5))).rejects.toThrow(
      "末尾缺失",
    );
  });
  it("does not overwrite another reader note", async () => {
    const a = await seed();
    await saveNote(a.id, "第一窗口笔记", a.note, database);
    await expect(
      saveNote(a.id, "第二窗口笔记", a.note, database),
    ).rejects.toThrow("另一窗口");
    expect((await database.articles.get(a.id))!.note).toBe("第一窗口笔记");
  });
  it("searches Chinese text, code, tags and notes using all terms", () => {
    const a = {
      ...articleDefaults("s"),
      body: "SD 卡 fread 缓冲",
      tags: ["ESP32"],
      note: "处理短读",
    };
    expect(searchArticles([a], "SD 短读")).toHaveLength(1);
    expect(searchArticles([{ ...a, deletedAt: 1 }], "SD")).toHaveLength(0);
    expect(searchArticles([a], "missing")).toHaveLength(0);
  });
  it("schedules another day after a failed review and progresses after understanding", () => {
    expect(nextReview(3, false, 0)).toEqual({
      reviewLevel: 0,
      reviewAt: 86400000,
    });
    expect(nextReview(0, true, 0)).toEqual({
      reviewLevel: 1,
      reviewAt: 3 * 86400000,
    });
    expect(nextReview(5, true, 0).reviewLevel).toBe(5);
  });
});
