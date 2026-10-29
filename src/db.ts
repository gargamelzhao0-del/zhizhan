import Dexie, { type Table } from "dexie";
import type { Article, Attachment, Revision, Setting, Shelf } from "./model";
import { uid } from "./model";
export class VaultDB extends Dexie {
  shelves!: Table<Shelf>;
  articles!: Table<Article>;
  attachments!: Table<Attachment>;
  revisions!: Table<Revision>;
  settings!: Table<Setting>;
  constructor(name = "zhizhan-v1") {
    super(name);
    this.version(1).stores({
      shelves: "id,kind",
      articles: "id,shelfId,updatedAt,deletedAt",
      attachments: "id",
      revisions: "id,articleId,savedAt",
      settings: "key",
    });
  }
}
export const db = new VaultDB();
// Compare and write within one transaction; another editor cannot silently overwrite a newer version.
export async function saveArticle(
  draft: Article,
  expected: number,
  database = db,
) {
  if (
    draft.body.length > 2 * 1024 * 1024 ||
    draft.title.length > 300 ||
    draft.tags.length > 30 ||
    draft.tags.some((t) => t.length > 100)
  )
    throw new Error(
      "内容超过首版限制：正文最多 2 Mi 字符，标题 300 字，最多 30 个短标签",
    );
  return database.transaction(
    "rw",
    [database.articles, database.revisions],
    async () => {
      const current = await database.articles.get(draft.id);
      if (!current) throw new Error("文章已不存在，请将内容另存为新文章");
      if (current.version !== expected)
        throw new Error(
          "文章已在另一窗口修改。当前草稿仍保留，请另存副本后重新打开",
        );
      await database.revisions.put({
        id: uid(),
        articleId: current.id,
        savedAt: Date.now(),
        article: current,
      });
      const next = {
        ...current,
        title: draft.title,
        body: draft.body,
        tags: draft.tags,
        shelfId: draft.shelfId,
        version: current.version + 1,
        updatedAt: Date.now(),
      };
      await database.articles.put(next);
      const old = await database.revisions
        .where("articleId")
        .equals(current.id)
        .sortBy("savedAt");
      if (old.length > 30)
        await database.revisions.bulkDelete(
          old.slice(0, old.length - 30).map((r) => r.id),
        );
      return next;
    },
  );
}
export async function patchArticle(id: string, patch: Partial<Article>) {
  await db.transaction("rw", db.articles, async () => {
    const current = await db.articles.get(id);
    if (current)
      await db.articles.put({
        ...current,
        ...patch,
        version:
          patch.deletedAt !== undefined ? current.version + 1 : current.version,
      });
  });
}
export async function saveNote(
  id: string,
  value: string,
  expected: string | null,
  database = db,
) {
  if (value.length > 128 * 1024) throw new Error("单篇笔记最多 128 Ki 字符");
  await database.transaction("rw", database.articles, async () => {
    const current = await database.articles.get(id);
    if (!current) throw new Error("文章不存在");
    if (current.note !== expected && current.note !== value)
      throw new Error("笔记已在另一窗口修改，请先复制当前草稿再重新打开");
    await database.articles.put({ ...current, note: value });
  });
}
export async function advanceProgress(
  id: string,
  progress: number,
  database = db,
) {
  await database.transaction("rw", database.articles, async () => {
    const current = await database.articles.get(id);
    if (current && !current.deletedAt && current.progress < progress)
      await database.articles.update(id, {
        progress: Math.max(0, Math.min(99, progress)),
      });
  });
}
export function readDraft(id: string): Article | undefined {
  try {
    const v = JSON.parse(localStorage.getItem(`draft:${id}`) || "null");
    return v?.id === id &&
      typeof v.body === "string" &&
      typeof v.version === "number"
      ? v
      : undefined;
  } catch {
    return undefined;
  }
}
export async function snapshot(database = db) {
  return database.transaction(
    "r",
    [
      database.shelves,
      database.articles,
      database.attachments,
      database.revisions,
      database.settings,
    ],
    async () => ({
      shelves: await database.shelves.toArray(),
      articles: await database.articles.toArray(),
      attachments: await database.attachments.toArray(),
      revisions: await database.revisions.toArray(),
      settings: await database.settings.toArray(),
    }),
  );
}
