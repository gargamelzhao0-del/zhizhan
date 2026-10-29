import { db, type VaultDB } from "./db";
import { rewriteLinks } from "./links";
import { articleDefaults, uid, type Attachment, type Article } from "./model";
export async function importMarkdown(files: File[], database: VaultDB = db) {
  if (!files.length) throw new Error("没有选择文件");
  if (
    files.length > 500 ||
    files.reduce((n, f) => n + f.size, 0) > 64 * 1024 * 1024
  )
    throw new Error("一次最多导入 500 个文件、64 MiB");
  const documents = files.filter((f) => /\.md$/i.test(f.name));
  if (!documents.length) throw new Error("请选择至少一个 Markdown 文件");
  const shelfId = uid(),
    ids = new Map<File, string>(files.map((f) => [f, uid()]));
  const assets: Attachment[] = files
    .filter((f) => !documents.includes(f))
    .map((f) => {
      if (f.size > 20 * 1024 * 1024)
        throw new Error(`附件 ${f.name} 超过 20 MiB`);
      return {
        id: ids.get(f)!,
        name: f.name,
        mime: f.type || "application/octet-stream",
        data: f,
        size: f.size,
      };
    });
  const articles: Article[] = [];
  for (const [index, f] of documents.entries()) {
    if (f.size > 2 * 1024 * 1024) throw new Error("单篇 Markdown 最大 2 MiB");
    let body = await f.text();
    const title = (
      body.match(/^#\s+(.+)$/m)?.[1]?.trim() || f.name.replace(/\.md$/i, "")
    ).slice(0, 300);
    body = rewriteLinks(body, (href) => {
      if (/^(?:[a-z][\w+.-]*:|#)/i.test(href)) return href;
      let name: string;
      const fragment = href.indexOf("#");
      const anchor = fragment >= 0 ? href.slice(fragment) : "";
      try {
        name = decodeURIComponent(href.split("#")[0]).split("/").pop()!;
      } catch {
        return href;
      }
      const candidates = files.filter((x) => x.name === name);
      if (candidates.length !== 1) return href;
      const target = candidates[0];
      return `${documents.includes(target) ? "doc" : "asset"}:${ids.get(target)}${anchor}`;
    });
    articles.push({
      ...articleDefaults(shelfId, title),
      id: ids.get(f)!,
      body,
      order: index,
    });
  }
  await database.transaction(
    "rw",
    [database.shelves, database.articles, database.attachments],
    async () => {
      await database.shelves.add({
        id: shelfId,
        title: `导入资料 · ${new Date().toLocaleDateString("zh-CN")}`,
        kind: "project",
        description: "从 Markdown 和附件导入，可继续编辑整理。",
        color: "#386557",
        createdAt: Date.now(),
      });
      await database.articles.bulkAdd(articles);
      await database.attachments.bulkAdd(assets);
    },
  );
  return { count: articles.length, shelfId };
}
